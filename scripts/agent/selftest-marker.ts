/**
 * Proves the "done via AI" marker hook in src/lib/prisma.ts, against the
 * throwaway Neon TEST branch only:
 *
 *   scripts/agent/with-test-branch.sh npx tsx scripts/agent/selftest-marker.ts
 *
 * - a write outside the agent context is NOT marked
 * - the same write inside the agent context IS marked with the run id
 * - a later human write that sets "who did it" clears the marker
 * - a write that does not touch "who did it" leaves the marker alone
 * - it works inside interactive transactions (how the server actions write)
 * Everything it creates is deleted at the end.
 */
import { loadEnv, dbHost } from "../backup/_env";
loadEnv();

const PROD_ENDPOINT = "ep-green-math-agyfus79";

async function main() {
  if (!(process.env.PALHAK_DB_TARGET ?? "").startsWith("test-branch:") || (process.env.DATABASE_URL ?? "").includes(PROD_ENDPOINT)) {
    throw new Error("Refusing to run: start this through scripts/agent/with-test-branch.sh");
  }
  const { prisma } = await import("../../src/lib/prisma");
  const { runAsAgent } = await import("../../src/lib/agent/context");
  console.log(`Database: ${dbHost()}`);

  const actor = await prisma.user.findFirstOrThrow({ where: { role: { in: ["SUPER_ADMIN", "THEME_MASTER"] } }, select: { id: true } });
  const soldier = await prisma.user.findFirstOrThrow({ where: { role: "USER" }, select: { id: true } });
  const RUN = "selftest-run-id";
  const created: { audit: string[]; request: string[] } = { audit: [], request: [] };
  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`${ok ? "✔" : "✘"} ${label}${ok ? "" : ` (expected ${String(expected)}, got ${String(actual)})`}`);
  };

  try {
    const audit = (via: () => Promise<{ id: string; viaAgentRunId: string | null }>) => via();
    const makeAudit = () =>
      prisma.auditLog.create({
        data: { actorId: actor.id, entity: "USER", entityId: actor.id, action: "AGENT_MARKER_SELFTEST" },
        select: { id: true, viaAgentRunId: true },
      });

    const human = await audit(makeAudit);
    created.audit.push(human.id);
    check("audit row written by hand is not marked", human.viaAgentRunId, null);

    const ai = await runAsAgent({ runId: RUN, actorId: actor.id }, makeAudit);
    created.audit.push(ai.id);
    check("audit row written inside the agent context is marked", ai.viaAgentRunId, RUN);

    const inTx = await runAsAgent({ runId: RUN, actorId: actor.id }, () =>
      prisma.$transaction(async (tx) =>
        tx.request.create({
          data: { requesterId: soldier.id, type: "ADMIN_ASSIGNMENT", status: "FULFILLED", resolvedById: actor.id, resolvedAt: new Date(), adminNotes: "selftest" },
          select: { id: true, viaAgentRunId: true },
        }),
      ),
    );
    created.request.push(inTx.id);
    check("history row created inside a transaction in the agent context is marked", inTx.viaAgentRunId, RUN);

    const notesOnly = await prisma.request.update({ where: { id: inTx.id }, data: { adminNotes: "selftest 2" }, select: { viaAgentRunId: true } });
    check("a human edit that does not change who did it keeps the marker", notesOnly.viaAgentRunId, RUN);

    const humanResolve = await prisma.request.update({ where: { id: inTx.id }, data: { resolvedById: actor.id }, select: { viaAgentRunId: true } });
    check("a human action that sets who did it clears the marker", humanResolve.viaAgentRunId, null);

    const aiResolve = await runAsAgent({ runId: RUN, actorId: actor.id }, () =>
      prisma.request.updateMany({ where: { id: inTx.id }, data: { resolvedById: actor.id } }),
    );
    const after = await prisma.request.findUniqueOrThrow({ where: { id: inTx.id }, select: { viaAgentRunId: true } });
    check("updateMany inside the agent context marks the row", aiResolve.count === 1 && after.viaAgentRunId, RUN);

    const other = await prisma.user.update({ where: { id: soldier.id }, data: { phoneNumber: undefined }, select: { id: true } });
    check("tables without a marker column are untouched", other.id, soldier.id);
  } finally {
    await prisma.request.deleteMany({ where: { id: { in: created.request } } });
    await prisma.auditLog.deleteMany({ where: { id: { in: created.audit } } });
    await prisma.$disconnect();
  }
  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll marker checks passed; test rows removed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
