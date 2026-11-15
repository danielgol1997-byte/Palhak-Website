import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Marks "this code is running on behalf of the AI agent".
 *
 * The agent executes confirmed plans by calling the site's normal server actions.
 * While it does, this context is active, and the Prisma hook in `lib/prisma.ts`
 * stamps every history row the action writes (requests, transfers, audit log,
 * ת״ש log…) with the AgentRun id. Screens then show "באמצעות סוכן AI" next to
 * the operator's name.
 */
export type AgentContext = { runId: string; actorId: string };

// Kept on globalThis so the dev server's hot reloads and separately bundled
// routes all share one store with the Prisma singleton.
const globalForAgent = globalThis as unknown as { __palhakAgentContext?: AsyncLocalStorage<AgentContext> };

const storage = (globalForAgent.__palhakAgentContext ??= new AsyncLocalStorage<AgentContext>());

export function runAsAgent<T>(ctx: AgentContext, fn: () => Promise<T>): Promise<T> {
  // Awaited inside the context on purpose: Prisma queries are lazy and only start
  // when awaited, so returning one un-awaited would run it outside the context.
  return storage.run(ctx, async () => await fn());
}

export function currentAgentContext(): AgentContext | undefined {
  return storage.getStore();
}
