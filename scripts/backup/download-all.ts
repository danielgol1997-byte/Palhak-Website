/**
 * Copy every backup stored in the database (and/or Blob) to ./backups/ locally.
 * Run this now and then so you also hold copies on your own machine / Drive.
 *   npm run backup:download
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, dbHost } from "./_env";

loadEnv();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { downloadBackupFromBlob } = await import("../../src/lib/backup/blob");
  const prisma = new PrismaClient();
  try {
    const dir = resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
    mkdirSync(dir, { recursive: true });
    const rows = await prisma.databaseBackup.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, kind: true, data: true, blobUrl: true, checksum: true, sizeBytes: true },
    });
    console.log(`${rows.length} backups in ${dbHost()}`);
    let written = 0;
    for (const r of rows) {
      const stamp = r.createdAt.toISOString().replace(/[:.]/g, "-");
      const file = resolve(dir, `palhak-backup-${r.kind.toLowerCase()}-${stamp}-${r.id.slice(-6)}.json.gz`);
      if (existsSync(file)) continue;
      let gz: Buffer | null = r.data ? Buffer.from(r.data) : null;
      if (!gz && r.blobUrl) gz = await downloadBackupFromBlob(r.blobUrl);
      if (!gz) {
        console.warn(`  skip ${r.id}: no data available`);
        continue;
      }
      writeFileSync(file, gz);
      writeFileSync(`${file}.sha256`, `${r.checksum}  ${file.split("/").pop()}\n`);
      written++;
      console.log(`  wrote ${file} (${(gz.length / 1024).toFixed(1)} KB)`);
    }
    console.log(`Done. ${written} new files in ${dir}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
