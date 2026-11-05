/**
 * Dump the whole database into ./backups/<timestamp>.json.gz on this machine.
 *   npm run backup:export
 * Optional: BACKUP_DIR=/path/to/folder
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, dbHost } from "./_env";

loadEnv();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { dumpDatabase, serializePayload } = await import("../../src/lib/backup/dump");
  const prisma = new PrismaClient();
  try {
    console.log(`Dumping database at ${dbHost()} ...`);
    const payload = await dumpDatabase(prisma);
    const { gz, raw, checksum, totalRows, tableCounts } = serializePayload(payload);
    const dir = resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = resolve(dir, `palhak-backup-${stamp}.json.gz`);
    writeFileSync(file, gz);
    writeFileSync(`${file}.sha256`, `${checksum}  ${file.split("/").pop()}\n`);
    console.log(`Wrote ${file}`);
    console.log(`  rows: ${totalRows} across ${Object.keys(tableCounts).length} tables`);
    console.log(`  size: ${(gz.length / 1024).toFixed(1)} KB gzipped (${(raw.length / 1024).toFixed(1)} KB raw)`);
    console.log(`  sha256: ${checksum}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
