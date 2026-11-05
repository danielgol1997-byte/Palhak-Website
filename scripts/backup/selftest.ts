/**
 * End-to-end backup self-test. SAFE to run against production WITHOUT the restore
 * flag: it creates a MANUAL backup row, verifies it, downloads it, and dry-runs
 * the restore plan.
 *
 *   npm run backup:selftest
 *
 * With SELFTEST_ALLOW_RESTORE=1 it ALSO performs a real restore from that backup
 * (replaces all data with an identical copy) and checks row counts match.
 * Only do that against a Neon branch, never against main.
 */
import { loadEnv, dbHost } from "./_env";

loadEnv();

async function main() {
  const { BackupKind } = await import("@prisma/client");
  const { prisma } = await import("../../src/lib/prisma");
  const { createBackup, verifyBackup, getBackupBytes, listBackups } = await import("../../src/lib/backup/store");
  const { parsePayload, listTables } = await import("../../src/lib/backup/dump");
  const { planRestore, executeRestore } = await import("../../src/lib/backup/restore");

  console.log(`Target: ${dbHost()}`);
  const t0 = Date.now();

  console.log("\n1) createBackup(MANUAL)");
  const created = await createBackup({ kind: BackupKind.MANUAL, trigger: "script", label: "selftest" });
  console.log(`   id=${created.id} rows=${created.totalRows} gz=${(created.sizeBytes / 1024).toFixed(1)}KB blob=${created.blobUrl ? "yes" : "no"}${created.mirrorError ? " mirrorError=" + created.mirrorError : ""} (${Date.now() - t0}ms)`);

  console.log("\n2) verifyBackup");
  const v = await verifyBackup(created.id);
  console.log(`   ok=${v.ok} checksum=${v.checksumOk} parse=${v.parseOk} counts=${v.countsOk} ${v.problems.join("; ")}`);
  if (!v.ok) throw new Error("verify failed");

  console.log("\n3) listBackups");
  const list = await listBackups(5);
  console.log(`   ${list.length} rows, newest ${list[0]?.kind} ${list[0]?.createdAt} inline=${list[0]?.hasInlineData}`);

  console.log("\n4) getBackupBytes + parse");
  const bytes = await getBackupBytes(created.id);
  if (!bytes) throw new Error("no bytes");
  const payload = parsePayload(bytes.gz);
  console.log(`   ${payload.tableOrder.length} tables, schema ${payload.schemaVersion}`);

  console.log("\n5) planRestore (dry run)");
  const plan = await planRestore(prisma, payload);
  console.log(`   restore ${plan.tablesToRestore.length} tables, skip ${plan.tablesSkipped.map((s) => s.name).join(",")}`);
  const warn = Object.keys(plan.droppedColumns).length + Object.keys(plan.missingColumns).length;
  console.log(`   schema drift warnings: ${warn}`);

  if (process.env.SELFTEST_ALLOW_RESTORE === "1") {
    console.log("\n6) executeRestore (REAL) — counting rows before");
    const tables = await listTables(prisma);
    const before: Record<string, number> = {};
    for (const t of tables) {
      const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
      before[t] = Number(r[0]!.c);
    }
    // Mutate something so we can prove the restore reverts it
    const probe = await prisma.auditLog.count();
    await prisma.auditLog.deleteMany({ where: {}, });
    console.log(`   deleted ${probe} AuditLog rows as a probe (now ${await prisma.auditLog.count()})`);

    await executeRestore(prisma, payload, plan, (m) => console.log("   " + m));

    let mismatches = 0;
    for (const t of plan.tablesToRestore) {
      const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*)::bigint AS c FROM "${t}"`);
      const after = Number(r[0]!.c);
      const expected = payload.tables[t]!.rows.length;
      if (after !== expected) {
        mismatches++;
        console.log(`   MISMATCH ${t}: ${after} != ${expected}`);
      }
    }
    console.log(`   AuditLog after restore: ${await prisma.auditLog.count()} (probe was ${probe})`);
    console.log(`   mismatches: ${mismatches}`);
    if (mismatches) throw new Error("restore produced different row counts");

    // Spot-check a few value types survived the round trip
    const u = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { email: true, role: true, createdAt: true, shirtSize: true } });
    const n = await prisma.adminNotification.findFirst({ select: { viewedBy: true, dismissedBy: true } });
    const th = await prisma.siteTheme.findUnique({ where: { id: "singleton" }, select: { tuning: true } });
    console.log(`   sample user: role=${u?.role} createdAt=${u?.createdAt.toISOString()} shirt=${u?.shirtSize}`);
    console.log(`   sample notification arrays: viewedBy=${n?.viewedBy.length} dismissedBy=${n?.dismissedBy.length}`);
    console.log(`   theme tuning json keys: ${th?.tuning ? Object.keys(th.tuning as object).length : 0}`);
  } else {
    console.log("\n6) restore skipped (set SELFTEST_ALLOW_RESTORE=1 on a Neon branch to test it)");
  }

  console.log(`\nSELFTEST OK in ${Date.now() - t0}ms`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("SELFTEST FAILED:", e);
  process.exit(1);
});
