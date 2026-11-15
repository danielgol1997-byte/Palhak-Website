import { PrismaClient } from "@prisma/client";
import { currentAgentContext } from "@/lib/agent/context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * History tables that carry `viaAgentRunId`, and the column(s) that say who did it.
 * Whenever a write sets the "who" column, the "via AI" marker is set with it:
 * the AgentRun id while the AI agent is executing a confirmed plan, null otherwise.
 */
const ACTOR_FIELDS: Record<string, readonly string[]> = {
  Request: ["resolvedById", "resolvedBy"],
  RequestItem: ["resolvedById", "resolvedBy"],
  Transfer: ["approvedById", "approvedBy"],
  Assignment: ["assignedById", "assignedBy"],
  BoxItem: ["movedById"],
  TashLog: ["performedById", "performedBy"],
  AuditLog: ["actorId", "actor"],
};

type Data = Record<string, unknown>;

function isRecord(v: unknown): v is Data {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function stampCreate(data: unknown, runId: string | undefined): unknown {
  if (!runId) return data;
  if (Array.isArray(data)) return data.map((row) => stampCreate(row, runId));
  return isRecord(data) ? { ...data, viaAgentRunId: runId } : data;
}

function stampUpdate(model: string, data: unknown, runId: string | undefined): unknown {
  if (!isRecord(data)) return data;
  const touchesActor = ACTOR_FIELDS[model].some((key) => data[key] !== undefined);
  return touchesActor ? { ...data, viaAgentRunId: runId ?? null } : data;
}

function createClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  const extended = base.$extends({
    name: "via-agent-marker",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!(model in ACTOR_FIELDS)) return query(args);
          const runId = currentAgentContext()?.runId;
          const a = args as Data;
          switch (operation) {
            case "create":
            case "createMany":
            case "createManyAndReturn":
              return query({ ...a, data: stampCreate(a.data, runId) } as typeof args);
            case "update":
            case "updateMany":
            case "updateManyAndReturn":
              return query({ ...a, data: stampUpdate(model, a.data, runId) } as typeof args);
            case "upsert":
              return query({
                ...a,
                create: stampCreate(a.create, runId),
                update: stampUpdate(model, a.update, runId),
              } as typeof args);
            default:
              return query(args);
          }
        },
      },
    },
  });

  // The extension only rewrites write arguments, so the public surface is unchanged.
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
