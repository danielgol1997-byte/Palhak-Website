import http from "node:http";

/**
 * A scripted stand-in for the Anthropic Messages API, used by tests/agent.spec.ts.
 *
 * The dev server started by scripts/agent/dev-agent-branch.sh sends its model
 * requests here. A test queues one handler per expected model call; each handler
 * sees the real request (system prompt, tool list, tool results so far) and
 * returns what "the model" says next. That exercises the whole agent – tools,
 * validation, plan storage, confirmation, execution, receipts – deterministically
 * and for free.
 */

export type MockContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type MockRequest = {
  model: string;
  system: { type: string; text: string }[] | string;
  tools: { name: string; description: string; input_schema: unknown }[];
  messages: { role: "user" | "assistant"; content: string | MockContentBlock[] }[];
};

export type MockReply = {
  text?: string;
  toolUses?: { name: string; input: unknown }[];
  stopReason?: "end_turn" | "tool_use" | "refusal" | "max_tokens";
};

export type MockHandler = (req: MockRequest) => MockReply;

export type ToolResult = { raw: string; json: unknown; isError: boolean };

/** The tool results the server sent back after the previous scripted tool calls. */
export function toolResults(req: MockRequest): ToolResult[] {
  const last = req.messages[req.messages.length - 1];
  if (!last || typeof last.content === "string") return [];
  return last.content
    .filter((b): b is Extract<MockContentBlock, { type: "tool_result" }> => b.type === "tool_result")
    .map((b) => {
      let json: unknown = null;
      try {
        json = JSON.parse(b.content);
      } catch {
        /* plain-text result */
      }
      return { raw: b.content, json, isError: Boolean(b.is_error) };
    });
}

export class MockAnthropic {
  private server: http.Server | null = null;
  private queue: MockHandler[] = [];
  private counter = 0;
  readonly requests: MockRequest[] = [];
  readonly problems: string[] = [];

  /** Queue the model's next replies, one per model call, in order. */
  script(...handlers: MockHandler[]) {
    this.queue.push(...handlers);
  }

  get pending(): number {
    return this.queue.length;
  }

  reset() {
    this.queue = [];
    this.requests.length = 0;
    this.problems.length = 0;
  }

  async start(port = 4010): Promise<void> {
    this.server = http.createServer((req, res) => {
      if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
        res.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as MockRequest;
        this.requests.push(body);
        const handler = this.queue.shift();
        if (!handler) {
          this.problems.push("The server called the model more times than the test scripted.");
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "mock: no scripted reply" } }));
          return;
        }
        let reply: MockReply;
        try {
          reply = handler(body);
        } catch (err) {
          this.problems.push(`A scripted handler threw: ${err instanceof Error ? err.message : String(err)}`);
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "mock: handler threw" } }));
          return;
        }
        const content: MockContentBlock[] = [];
        if (reply.text) content.push({ type: "text", text: reply.text });
        for (const use of reply.toolUses ?? []) {
          content.push({ type: "tool_use", id: `toolu_mock_${++this.counter}`, name: use.name, input: use.input });
        }
        const stop_reason = reply.stopReason ?? (reply.toolUses?.length ? "tool_use" : "end_turn");
        res.writeHead(200, { "content-type": "application/json", "request-id": `req_mock_${this.counter}` });
        res.end(
          JSON.stringify({
            id: `msg_mock_${++this.counter}`,
            type: "message",
            role: "assistant",
            model: body.model,
            content,
            stop_reason,
            stop_sequence: null,
            usage: { input_tokens: 1000, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        );
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, "127.0.0.1", () => resolve());
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }
}
