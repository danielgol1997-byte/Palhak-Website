import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAgentAccess } from "@/lib/agent/access";
import { AgentUnavailableError, assertWithinRateLimit, runAgentTurn } from "@/lib/agent/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(8000),
        runId: z.string().max(64).optional(),
      }),
    )
    .min(1)
    .max(80),
});

function friendlyError(err: unknown): string {
  if (err instanceof AgentUnavailableError) return err.message;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return "מפתח ה-API של הסוכן אינו תקין. יש לעדכן את ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) return "שירות ה-AI עמוס כרגע. נסה שוב בעוד רגע.";
  if (err instanceof Anthropic.APIConnectionError) return "אין חיבור לשירות ה-AI כרגע. נסה שוב.";
  if (err instanceof Anthropic.APIError) return "שירות ה-AI החזיר שגיאה. נסה שוב בעוד רגע.";
  return "אירעה שגיאה בסוכן. שום דבר לא בוצע.";
}

/**
 * One chat turn. Streams newline-delimited JSON:
 *   {"type":"status","label":"מחפש אנשים"}   progress while lookups run
 *   {"type":"reply","text":"…","run":{…}|null} the answer, with a plan awaiting confirmation if one was drafted
 *   {"type":"error","message":"…"}
 * Nothing is ever executed from this endpoint.
 */
export async function POST(req: NextRequest) {
  const access = await getAgentAccess();
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return NextResponse.json({ message: "בקשה לא תקינה." }, { status: 400 });
  }

  try {
    await assertWithinRateLimit(access.actor);
  } catch (err) {
    // 429 only when the operator really is over the allowance; anything else (the database is unreachable) is a server fault.
    if (!(err instanceof AgentUnavailableError)) console.error("[agent] rate-limit check failed", err);
    return NextResponse.json({ message: friendlyError(err) }, { status: err instanceof AgentUnavailableError ? 429 : 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const result = await runAgentTurn({
          actor: access.actor,
          history: parsed.data.messages,
          onStatus: (label) => send({ type: "status", label }),
        });
        send({ type: "reply", text: result.text, run: result.run });
      } catch (err) {
        if (!(err instanceof AgentUnavailableError)) console.error("[agent] chat turn failed", err);
        send({ type: "error", message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
