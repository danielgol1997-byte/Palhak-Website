import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AGENT_ACTIONS, actionAllowedFor, previewStep } from "./actions";
import { READ_TOOLS, getReadTool } from "./readTools";
import { AGENT_SYSTEM_PROMPT, requestContextBlock } from "./prompt";
import { createProposedRun, loadRunViews, runOutcomeNote, type RunView } from "./runs";
import { PlanError, type AgentActor, type PlanStep } from "./types";

/**
 * One chat turn: the model reads data through lookup tools and drafts a plan
 * through action tools. Nothing is executed here. If the turn ends with a
 * draft, it is stored as a PROPOSED AgentRun and shown to the operator.
 */

/** Cheapest current model; the plan → confirm → receipt design keeps mistakes visible and harmless. */
export const DEFAULT_AGENT_MODEL = "claude-haiku-5-5";

const MAX_MODEL_CALLS = 10;
const MAX_PLAN_STEPS = 12;
const MAX_TOOL_RESULT_CHARS = 14_000;
const MAX_HISTORY_MESSAGES = 30;
const DISCARD_TOOL = "discard_draft_plan";

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Per-operator allowance. Override with AGENT_RATE_PER_MINUTE / AGENT_RATE_PER_DAY. */
export const AGENT_LIMITS = {
  perMinute: envInt("AGENT_RATE_PER_MINUTE", 12),
  perDay: envInt("AGENT_RATE_PER_DAY", 300),
} as const;

export function agentModel(): string {
  return process.env.AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL;
}

export function agentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function client(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Explicit, so an unrelated ANTHROPIC_BASE_URL in the environment can never redirect requests.
    baseURL: process.env.AGENT_API_BASE_URL?.trim() || "https://api.anthropic.com",
    timeout: 45_000,
    maxRetries: 2,
  });
}

function inputSchema(schema: z.ZodType): Anthropic.Tool["input_schema"] {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool["input_schema"];
}

function buildTools(actor: AgentActor): Anthropic.Tool[] {
  const lookups: Anthropic.Tool[] = READ_TOOLS.map((t) => ({
    name: t.name,
    description: `[lookup] ${t.description}`,
    input_schema: inputSchema(t.schema),
  }));
  const actions: Anthropic.Tool[] = AGENT_ACTIONS.filter((a) => actionAllowedFor(a, actor)).map((a) => ({
    name: a.name,
    description: `[action – adds a step to the draft plan, executes nothing] ${a.description}`,
    input_schema: inputSchema(a.schema),
  }));
  const discard: Anthropic.Tool = {
    name: DISCARD_TOOL,
    description: "Throw away every step added to the draft plan in this turn, so you can add the correct steps again.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  };
  return [...lookups, ...actions, discard];
}

export type ChatHistoryMessage = { role: "user" | "assistant"; text: string; runId?: string };

export type AgentTurnResult = { text: string; run: RunView | null };

export class AgentUnavailableError extends Error {}

/** Throws when the operator has used up the per-minute or per-day allowance. */
export async function assertWithinRateLimit(actor: AgentActor): Promise<void> {
  const now = Date.now();
  const [lastMinute, lastDay] = await Promise.all([
    prisma.agentTurn.count({ where: { actorId: actor.id, createdAt: { gt: new Date(now - 60_000) } } }),
    prisma.agentTurn.count({ where: { actorId: actor.id, createdAt: { gt: new Date(now - 86_400_000) } } }),
  ]);
  if (lastMinute >= AGENT_LIMITS.perMinute) throw new AgentUnavailableError("יותר מדי בקשות בדקה האחרונה. נסה שוב בעוד רגע.");
  if (lastDay >= AGENT_LIMITS.perDay) throw new AgentUnavailableError("הגעת למכסת הבקשות היומית של הסוכן.");
}

async function toModelMessages(history: ChatHistoryMessage[], actor: AgentActor): Promise<Anthropic.MessageParam[]> {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  // Plan outcomes come from the database, never from what the browser claims happened.
  const runs = await loadRunViews(recent.flatMap((m) => (m.runId ? [m.runId] : [])), actor);
  const messages: Anthropic.MessageParam[] = [];
  // What became of a plan is reported at the start of the operator's next message,
  // not inside the assistant's own turn, so the model never sees itself "writing" such notes.
  let pendingNotes: string[] = [];
  for (const m of recent) {
    const text = m.text.trim();
    if (m.role === "assistant") {
      // The first message must come from the user.
      if (messages.length === 0) continue;
      const run = m.runId ? runs.get(m.runId) : undefined;
      if (run) pendingNotes.push(runOutcomeNote(run));
      if (text) messages.push({ role: "assistant", content: text });
      continue;
    }
    if (!text) continue;
    const content: Anthropic.TextBlockParam[] = [
      ...pendingNotes.map((note): Anthropic.TextBlockParam => ({ type: "text", text: note })),
      { type: "text", text },
    ];
    pendingNotes = [];
    messages.push({ role: "user", content: content.length === 1 ? text : content });
  }
  return messages;
}

function clip(json: string): string {
  return json.length <= MAX_TOOL_RESULT_CHARS
    ? json
    : `${json.slice(0, MAX_TOOL_RESULT_CHARS)}… [truncated: narrow the lookup to see the rest]`;
}

export async function runAgentTurn(input: {
  actor: AgentActor;
  history: ChatHistoryMessage[];
  onStatus?: (label: string) => void;
}): Promise<AgentTurnResult> {
  const { actor, onStatus } = input;
  if (!agentConfigured()) throw new AgentUnavailableError("הסוכן עדיין לא הוגדר: חסר מפתח API (ANTHROPIC_API_KEY).");

  const messages = await toModelMessages(input.history, actor);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") throw new AgentUnavailableError("לא התקבלה הודעה.");
  const userPrompt = input.history[input.history.length - 1]?.text ?? "";

  const model = agentModel();
  const tools = buildTools(actor);
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: requestContextBlock(actor.name, new Date()) },
  ];

  const draft: PlanStep[] = [];
  const usage = { input: 0, output: 0, cache: 0, toolCalls: 0 };
  let finalText = "";
  let finished = false;

  try {
    for (let call = 0; call < MAX_MODEL_CALLS && !finished; call++) {
      const response = await client().messages.create({
        model,
        max_tokens: 8000,
        system,
        tools,
        messages,
        output_config: { effort: "medium" },
      });

      // Cache writes are billed slightly above the input rate; count them as input.
      usage.input += response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0);
      usage.output += response.usage.output_tokens;
      usage.cache += response.usage.cache_read_input_tokens ?? 0;

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      if (response.stop_reason === "refusal") {
        draft.length = 0;
        finalText = "לא אוכל לעזור בבקשה הזאת. אפשר לנסח אותה אחרת או לבצע אותה ישירות במסכי המערכת.";
        break;
      }
      if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
        draft.length = 0;
        finalText = "התשובה נקטעה באמצע. נסה לפצל את הבקשה לחלקים קטנים יותר.";
        break;
      }

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        finalText = text;
        finished = true;
        break;
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const use of toolUses) {
        usage.toolCalls++;
        const result = await handleToolCall(use, actor, draft, onStatus);
        results.push({ type: "tool_result", tool_use_id: use.id, content: clip(result.content), is_error: result.isError });
      }
      messages.push({ role: "user", content: results });
    }
  } finally {
    await prisma.agentTurn
      .create({
        data: {
          actorId: actor.id,
          model,
          inputTokens: usage.input,
          outputTokens: usage.output,
          cacheTokens: usage.cache,
          toolCalls: usage.toolCalls,
        },
      })
      .catch(() => undefined);
  }

  if (!finished && !finalText) {
    draft.length = 0;
    finalText = "לא הצלחתי להשלים את הבקשה במספר הצעדים המותר. נסה לנסח אותה בצורה ממוקדת יותר.";
  }

  if (draft.length === 0) return { text: finalText || "לא התקבלה תשובה. נסה שוב.", run: null };

  const summary = finalText || draft.map((s) => s.title).join(" · ");
  const run = await createProposedRun({ actor, userPrompt, summary, steps: draft, model });
  return { text: finalText || "הכנתי תוכנית. בדוק אותה ואשר כדי לבצע.", run };
}

async function handleToolCall(
  use: Anthropic.ToolUseBlock,
  actor: AgentActor,
  draft: PlanStep[],
  onStatus?: (label: string) => void,
): Promise<{ content: string; isError?: boolean }> {
  if (use.name === DISCARD_TOOL) {
    const count = draft.length;
    draft.length = 0;
    return { content: `Draft plan cleared (${count} step(s) removed).` };
  }

  const lookup = getReadTool(use.name);
  if (lookup) {
    onStatus?.(lookup.statusLabel);
    const parsed = lookup.schema.safeParse(use.input);
    if (!parsed.success) {
      return { content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    }
    try {
      return { content: JSON.stringify(await lookup.run(parsed.data)) };
    } catch {
      return { content: "The lookup failed because of a server error. Try once more, then tell the operator.", isError: true };
    }
  }

  // Everything else is an action: validate it against live data and add it to the draft.
  onStatus?.("מכין תוכנית");
  if (draft.length >= MAX_PLAN_STEPS) {
    return { content: `The draft plan already has ${MAX_PLAN_STEPS} steps, the maximum. Tell the operator to confirm this part first.`, isError: true };
  }
  try {
    const { params, view } = await previewStep(use.name, use.input, actor);
    draft.push({ action: use.name, params, title: view.title, details: view.details });
    return {
      content: JSON.stringify({
        addedToDraftPlan: true,
        stepNumber: draft.length,
        willShowOperator: view,
        executed: false,
      }),
    };
  } catch (err) {
    if (err instanceof PlanError) return { content: `Step NOT added: ${err.message}`, isError: true };
    return { content: "Step NOT added because of a server error. Tell the operator it could not be prepared.", isError: true };
  }
}
