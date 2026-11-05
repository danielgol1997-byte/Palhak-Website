/**
 * Restore the database from a backup. DESTRUCTIVE: replaces the contents of
 * every table with the rows in the backup, inside a single transaction.
 *
 *   npm run backup:restore -- --file backups/palhak-backup-....json.gz          (dry run)
 *   npm run backup:restore -- --id <DatabaseBackup id>                           (dry run)
 *   npm run backup:restore -- --file ... --yes-replace-all-data                  (really do it)
 *
 * Safety:
 *  1. Without --yes-replace-all-data the script only prints the plan.
 *  2. Before writing, a PRE_RESTORE backup of the CURRENT data is saved to the
 *     DatabaseBackup table and to ./backups/ so the restore itself can be undone.
 *  3. Strongly recommended: point DATABASE_URL/DIRECT_URL at a Neon *branch*
 *     first, check the result, then restore on main.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, dbHost } from "./_env";

loadEnv();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);

async function main() {
  const { PrismaClient, BackupKind } = await import("@prisma/client");
  const { parsePayload, sha256, dumpDatabase, serializePayload } = await import("../../src/lib/backup/dump");
  const { planRestore, executeRestore } = await import("../../src/lib/backup/restore");
  const { downloadBackupFromBlob } = await import("../../src/lib/backup/blob");

  const file = arg("--file");
  const id = arg("--id");
  if (!file && !id) {
    console.error("Usage: --file <path.json.gz> | --id <backupId>  [--yes-replace-all-data]");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    let gz: Buffer;
    if (file) {
      gz = readFileSync(resolve(process.cwd(), file));
      console.log(`Backup file: ${file} (${(gz.length / 1024).toFixed(1)} KB)`);
    } else {
      const row = await prisma.databaseBackup.findUnique({
        where: { id: id! },
        select: { data: true, blobUrl: true, checksum: true, createdAt: true, kind: true },
      });
      if (!row) throw new Error(`Backup ${id} not found`);
      let bytes: Buffer | null = row.data ? Buffer.from(row.data) : null;
      if (!bytes && row.blobUrl) bytes = await downloadBackupFromBlob(row.blobUrl);
      if (!bytes) throw new Error("Backup has no data (inline copy pruned and no blob mirror)");
      if (sha256(bytes) !== row.checksum) throw new Error("Checksum mismatch – refusing to restore");
      gz = bytes;
      console.log(`Backup ${id}: ${row.kind} from ${row.createdAt.toISOString()} (checksum OK)`);
    }

    const payload = parsePayload(gz);
    console.log(`Payload created ${payload.createdAt}, schema ${payload.schemaVersion ?? "?"}, from ${payload.databaseHost ?? "?"}`);
    const plan = await planRestore(prisma, payload);

    console.log("\nRestore plan (target: " + dbHost() + ")");
    for (const t of plan.tablesToRestore) {
      const notes: string[] = [];
      if (plan.droppedColumns[t]) notes.push(`dropping columns ${plan.droppedColumns[t].join(", ")}`);
      if (plan.missingColumns[t]) notes.push(`live-only columns ${plan.missingColumns[t].join(", ")} will be NULL/default`);
      console.log(`  ${t.padEnd(24)} ${String(plan.rowCounts[t]).padStart(7)} rows ${notes.length ? "  ⚠ " + notes.join("; ") : ""}`);
    }
    for (const s of plan.tablesSkipped) console.log(`  skip ${s.name}: ${s.reason}`);

    if (!has("--yes-replace-all-data")) {
      console.log("\nDry run only. Re-run with --yes-replace-all-data to apply.");
      return;
    }

    console.log("\nSaving a PRE_RESTORE backup of the current data ...");
    const current = await dumpDatabase(prisma);
    const cur = serializePayload(current);
    const dir = resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const preFile = resolve(dir, `palhak-pre-restore-${stamp}.json.gz`);
    writeFileSync(preFile, cur.gz);
    await prisma.databaseBackup.create({
      data: {
        kind: BackupKind.PRE_RESTORE,
        trigger: "pre-restore",
        label: `before restoring ${file ?? id}`,
        schemaVersion: current.schemaVersion,
        appCommit: null,
        tableCounts: cur.tableCounts,
        totalRows: cur.totalRows,
        rawBytes: cur.raw.length,
        sizeBytes: cur.gz.length,
        checksum: cur.checksum,
        storage: "db",
        data: new Uint8Array(cur.gz),
        verifiedAt: new Date(),
      },
    });
    console.log(`  saved ${preFile} and a PRE_RESTORE row in DatabaseBackup`);

    console.log("\nRestoring ...");
    await executeRestore(prisma, payload, plan, (m) => console.log("  " + m));
    console.log("\nDone. Restored " + plan.tablesToRestore.length + " tables.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\nRESTORE FAILED (no changes were applied):", e instanceof Error ? e.message : e);
  process.exit(1);
});
