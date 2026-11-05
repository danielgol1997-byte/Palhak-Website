/** Check a local backup file: gunzip, parse, print table counts. npm run backup:verify -- <file> */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run backup:verify -- backups/<file>.json.gz");
    process.exit(2);
  }
  const { parsePayload, sha256 } = await import("../../src/lib/backup/dump");
  const gz = readFileSync(resolve(process.cwd(), file));
  const payload = parsePayload(gz);
  console.log(`OK  ${file}`);
  console.log(`  sha256 ${sha256(gz)}`);
  console.log(`  created ${payload.createdAt}  schema ${payload.schemaVersion ?? "?"}`);
  let total = 0;
  for (const t of payload.tableOrder) {
    const n = payload.tables[t]?.rows.length ?? 0;
    total += n;
    console.log(`  ${t.padEnd(24)} ${String(n).padStart(7)}`);
  }
  console.log(`  total rows ${total}`);
}

main().catch((e) => {
  console.error("INVALID:", e instanceof Error ? e.message : e);
  process.exit(1);
});
