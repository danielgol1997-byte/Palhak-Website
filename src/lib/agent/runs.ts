import { AgentRunStatus, Prisma, type AgentRun } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runAsAgent } from "./context";
import { previewStep } from "./actions";
import { PlanError, type AgentActor, type PlanStep, type ReceiptStep, type StepView } from "./types";

/** How long a drafted plan may wait for the operator before it can no longer be confirmed. */
export const PLAN_TTL_MS = 15 * 60 * 1000;
/** An execution still "running" after this long was cut off (e.g. the server function timed out). */
const STALE_EXECUTION_MS = 5 * 60 * 1000;

/** What the chat and the history page render. Safe to send to the browser. */
export type RunView = {
  id: string;
  status: AgentRunStatus | "INTERRUPTED";
  summary: string;
  userPrompt: string;
  steps: StepView[];
  receipt: ReceiptStep[] | null;
  actorName?: string;
  createdAt: string;
  expiresAt: string;
  finishedAt: string | null;
};

type RunRow = AgentRun & { actor?: { name: string } | null };

function asSteps(json: Prisma.JsonValue): PlanStep[] {
  return Array.isArray(json) ? (json as unknown as PlanStep[]) : [];
}

function asReceipt(json: Prisma.JsonValue | null): ReceiptStep[] | null {
  return Array.isArray(json) ? (json as unknown as ReceiptStep[]) : null;
}

export function toRunView(run: RunRow, now = new Date()): RunView {
  let status: RunView["status"] = run.status;
  if (status === "PROPOSED" && run.expiresAt <= now) status = "EXPIRED";
  if (status === "EXECUTING" && now.getTime() - (run.confirmedAt ?? run.updatedAt).getTime() > STALE_EXECUTION_MS) {
    status = "INTERRUPTED";
  }
  return {
    id: run.id,
    status,
    summary: run.summary,
    userPrompt: run.userPrompt,
    steps: asSteps(run.plan).map(({ title, details }) => ({ title, details })),
    receipt: asReceipt(run.receipt),
    actorName: run.actor?.name,
    createdAt: run.createdAt.toISOString(),
    expiresAt: run.expiresAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

/** Store a drafted plan. Older unconfirmed plans of the same operator are withdrawn so only one can be confirmed. */
export async function createProposedRun(input: {
  actor: AgentActor;
  userPrompt: string;
  summary: string;
  steps: PlanStep[];
  model: string;
}): Promise<RunView> {
  const now = new Date();
  const run = await prisma.$transaction(async (tx) => {
    await tx.agentRun.updateMany({
      where: { actorId: input.actor.id, status: AgentRunStatus.PROPOSED },
      data: { status: AgentRunStatus.CANCELLED, finishedAt: now },
    });
    return tx.agentRun.create({
      data: {
        actorId: input.actor.id,
        userPrompt: input.userPrompt.slice(0, 4000),
        summary: input.summary.slice(0, 600),
        plan: input.steps as unknown as Prisma.InputJsonValue,
        model: input.model,
        expiresAt: new Date(now.getTime() + PLAN_TTL_MS),
      },
    });
  });
  return toRunView(run, now);
}

export class RunStateError extends Error {}

async function loadOwnRun(runId: string, actor: AgentActor): Promise<AgentRun> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run || run.actorId !== actor.id) throw new RunStateError("התוכנית לא נמצאה.");
  return run;
}

function whyNotConfirmable(run: AgentRun, now: Date): string {
  const expired = "פג תוקף התוכנית ושום דבר לא בוצע. בקש מהסוכן להכין אותה מחדש.";
  if (run.status === "PROPOSED" && run.expiresAt <= now) return expired;
  switch (run.status) {
    case "EXPIRED":
      return expired;
    case "CANCELLED":
      return "התוכנית בוטלה ושום דבר לא בוצע.";
    case "EXECUTING":
      return "התוכנית כבר בביצוע.";
    case "PROPOSED":
      return "לא ניתן לאשר את התוכנית כרגע.";
    default:
      return "התוכנית כבר בוצעה.";
  }
}

export async function cancelRun(runId: string, actor: AgentActor): Promise<RunView> {
  await loadOwnRun(runId, actor);
  await prisma.agentRun.updateMany({
    where: { id: runId, actorId: actor.id, status: AgentRunStatus.PROPOSED },
    data: { status: AgentRunStatus.CANCELLED, finishedAt: new Date() },
  });
  return toRunView(await loadOwnRun(runId, actor));
}

/**
 * Execute a plan the operator has just confirmed.
 *
 * - The PROPOSED → EXECUTING switch is a single conditional update, so a double
 *   click or two tabs can never run the same plan twice.
 * - Every step is checked against live data again right before it runs.
 * - Steps run in order, each through the site's own server action, inside the
 *   agent context so their history rows are marked "via AI".
 * - The first failure stops the plan; later steps are recorded as skipped.
 * - The receipt is saved after every step, so progress survives an interruption.
 */
export async function confirmAndExecuteRun(runId: string, actor: AgentActor): Promise<RunView> {
  const now = new Date();
  const existing = await loadOwnRun(runId, actor);

  const claimed = await prisma.agentRun.updateMany({
    where: { id: runId, actorId: actor.id, status: AgentRunStatus.PROPOSED, expiresAt: { gt: now } },
    data: { status: AgentRunStatus.EXECUTING, confirmedAt: now },
  });
  if (claimed.count !== 1) {
    if (existing.status === "PROPOSED" && existing.expiresAt <= now) {
      await prisma.agentRun.updateMany({
        where: { id: runId, status: AgentRunStatus.PROPOSED },
        data: { status: AgentRunStatus.EXPIRED, finishedAt: now },
      });
    }
    throw new RunStateError(whyNotConfirmable(await loadOwnRun(runId, actor), now));
  }

  const steps = asSteps(existing.plan);
  const receipt: ReceiptStep[] = [];
  let failed = false;

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    if (failed) {
      receipt.push({ index, action: step.action, title: step.title, details: step.details, status: "skipped" });
      continue;
    }
    let view: StepView = { title: step.title, details: step.details };
    try {
      const checked = await previewStep(step.action, step.params, actor);
      view = checked.view;
      await runAsAgent({ runId, actorId: actor.id }, () => checked.action.execute(checked.params, actor));
      receipt.push({ index, action: step.action, ...view, status: "done" });
    } catch (err) {
      failed = true;
      const message = err instanceof PlanError || err instanceof Error ? err.message : "שגיאה לא צפויה.";
      receipt.push({ index, action: step.action, ...view, status: "failed", error: message });
    }
    await prisma.agentRun.update({
      where: { id: runId },
      data: { receipt: receipt as unknown as Prisma.InputJsonValue },
    });
  }

  const done = receipt.filter((r) => r.status === "done").length;
  const status = !failed ? AgentRunStatus.DONE : done > 0 ? AgentRunStatus.PARTIAL : AgentRunStatus.FAILED;
  const finished = await prisma.agentRun.update({
    where: { id: runId },
    data: { status, receipt: receipt as unknown as Prisma.InputJsonValue, finishedAt: new Date() },
  });
  return toRunView(finished);
}

/** Runs referenced by the chat history, limited to the operator's own. */
export async function loadRunViews(runIds: string[], actor: AgentActor): Promise<Map<string, RunView>> {
  if (runIds.length === 0) return new Map();
  const runs = await prisma.agentRun.findMany({ where: { id: { in: runIds.slice(0, 50) }, actorId: actor.id } });
  const now = new Date();
  return new Map(runs.map((r) => [r.id, toRunView(r, now)]));
}

export async function listRecentRuns(limit = 50): Promise<RunView[]> {
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true } } },
  });
  const now = new Date();
  return runs.map((r) => toRunView(r, now));
}

/** One factual line per plan, appended to the conversation so the model knows what really happened. */
export function runOutcomeNote(run: RunView): string {
  const steps = run.steps.map((s) => s.title).join("; ");
  switch (run.status) {
    case "PROPOSED":
      return `[system note: the plan (${steps}) is still waiting for the operator's confirmation; nothing was executed]`;
    case "CANCELLED":
      return `[system note: the operator cancelled the plan (${steps}); nothing was executed]`;
    case "EXPIRED":
      return `[system note: the plan (${steps}) expired without confirmation; nothing was executed]`;
    case "EXECUTING":
      return `[system note: the plan (${steps}) is being executed right now]`;
    case "INTERRUPTED":
      return `[system note: execution of the plan (${steps}) was interrupted; look the records up again to see what was applied]`;
    default: {
      const lines = (run.receipt ?? []).map(
        (r) => `${r.title}: ${r.status === "done" ? "done" : r.status === "failed" ? `FAILED (${r.error})` : "skipped"}`,
      );
      return `[system note: the operator confirmed the plan and the system executed it. Result: ${lines.join("; ")}. Ids from before this point may be stale.]`;
    }
  }
}
