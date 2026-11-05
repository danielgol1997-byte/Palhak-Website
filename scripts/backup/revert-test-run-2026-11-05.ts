/* eslint-disable @typescript-eslint/no-explicit-any -- one-off maintenance script working on raw rows */
/**
 * One-off, self-checking revert of the changes made by the legacy Playwright
 * specs (tests/boxes.spec.ts, tests/tash.spec.ts) when they ran against the
 * production database on 2026-11-05 between 18:09 and 18:12 UTC.
 *
 *   npx tsx scripts/backup/revert-test-run-2026-11-05.ts            (dry run: prints the diff)
 *   npx tsx scripts/backup/revert-test-run-2026-11-05.ts --apply    (reverts, then re-diffs)
 *
 * What it does: compares every table with backup cmw3uvwht0000xclnyc9ed7da
 * ("first-backup-after-migration", taken 18:05 UTC, right before the run).
 * It only proceeds if the difference is EXACTLY the reviewed one:
 *   AuditLog          +16 test actions
 *   Assignment        +6  (items "restored" out of דרור שטרית's box)
 *   BoxItem           -6  (the same items, removed from the box)
 *   BoxTemplateItem   +2 test rows, -6 real rows
 *   BoxTemplateItemAlt -8 (alternatives of the deleted template rows)
 * Any other difference aborts before writing. The revert runs in one
 * transaction: deletes the added rows, re-inserts the removed rows verbatim.
 */
import { loadEnv, dbHost } from "./_env";
loadEnv();

const BACKUP_ID = "cmw3uvwht0000xclnyc9ed7da";
const EXPECTED: Record<string, [added: number, removed: number, changed: number]> = {
  AuditLog: [16, 0, 0],
  Assignment: [6, 0, 0],
  BoxItem: [0, 6, 0],
  BoxTemplateItem: [2, 6, 0],
  BoxTemplateItemAlt: [0, 8, 0],
};
const SKIP = new Set(["DatabaseBackup", "_prisma_migrations"]);
const norm = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (x instanceof Date ? x.toISOString() : typeof x === "bigint" ? Number(x) : x));

type Row = Record<string, unknown> & { id?: string };
type Diff = { name: string; added: Row[]; removed: Row[]; changed: string[] };

async function diff(prisma: any, tables: { name: string; rows: Row[] }[]): Promise<Diff[]> {
  const out: Diff[] = [];
  for (const t of tables) {
    if (SKIP.has(t.name)) continue;
    const nowRows: Row[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${t.name}"`);
    const key = (r: Row) => (r.id as string) ?? norm(r);
    const was = new Map(t.rows.map((r) => [key(r), r]));
    const now = new Map(nowRows.map((r) => [key(r), r]));
    const added = [...now.keys()].filter((k) => !was.has(k)).map((k) => now.get(k)!);
    const removed = [...was.keys()].filter((k) => !now.has(k)).map((k) => was.get(k)!);
    const changed = [...now.keys()].filter(
      (k) => was.has(k) && norm(JSON.parse(norm(now.get(k)))) !== norm(JSON.parse(norm(was.get(k))))
    );
    if (added.length || removed.length || changed.length) out.push({ name: t.name, added, removed, changed });
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { PrismaClient } = await import("@prisma/client");
  const { parsePayload } = await import("../../src/lib/backup/dump");
  const prisma = new PrismaClient();
  console.log(`Database: ${dbHost()}  (${apply ? "APPLY" : "dry run"})`);

  const bk = await prisma.databaseBackup.findUnique({ where: { id: BACKUP_ID }, select: { data: true, label: true, createdAt: true } });
  if (!bk?.data) throw new Error(`Backup ${BACKUP_ID} not found or has no inline data`);
  console.log(`Reference backup: ${bk.label} (${bk.createdAt.toISOString()})`);
  const payload: any = await parsePayload(Buffer.from(bk.data));
  const tables: { name: string; rows: Row[] }[] = Array.isArray(payload.tables)
    ? payload.tables
    : Object.entries(payload.tables ?? payload).map(([name, t]: any) => ({ name, rows: t.rows ?? t }));

  const before = await diff(prisma, tables);
  for (const d of before) console.log(`  ${d.name.padEnd(20)} +${d.added.length} -${d.removed.length} ~${d.changed.length}`);
  if (before.length === 0) { console.log("Nothing to do: database already matches the backup."); await prisma.$disconnect(); return; }

  for (const d of before) {
    const e = EXPECTED[d.name];
    if (!e || e[0] !== d.added.length || e[1] !== d.removed.length || e[2] !== d.changed.length)
      throw new Error(`Unexpected difference in ${d.name} – aborting, nothing written. Review manually.`);
  }
  if (before.length !== Object.keys(EXPECTED).length) throw new Error("Difference set is not the reviewed one – aborting.");
  if (!apply) { console.log("\nDry run only. Re-run with --apply to revert these rows."); await prisma.$disconnect(); return; }

  const byName = new Map(before.map((d) => [d.name, d]));
  const deleteOrder = ["AuditLog", "Assignment", "BoxTemplateItemAlt", "BoxTemplateItem", "BoxItem"];
  const insertOrder = ["BoxTemplateItem", "BoxTemplateItemAlt", "BoxItem", "Assignment", "AuditLog"];
  await prisma.$transaction(
    async (tx: any) => {
      for (const n of deleteOrder) {
        const d = byName.get(n); if (!d?.added.length) continue;
        const ids = d.added.map((r) => r.id);
        const c = await tx.$executeRawUnsafe(`DELETE FROM "${n}" WHERE "id" = ANY($1::text[])`, ids);
        console.log(`  deleted ${c} from ${n}`);
        if (c !== ids.length) throw new Error(`expected to delete ${ids.length} from ${n}`);
      }
      for (const n of insertOrder) {
        const d = byName.get(n); if (!d?.removed.length) continue;
        const c = await tx.$executeRawUnsafe(
          `INSERT INTO "${n}" SELECT * FROM json_populate_recordset(NULL::"${n}", $1::json)`,
          JSON.stringify(d.removed)
        );
        console.log(`  re-inserted ${c} into ${n}`);
        if (c !== d.removed.length) throw new Error(`expected to insert ${d.removed.length} into ${n}`);
      }
    },
    { timeout: 60_000 }
  );

  const after = await diff(prisma, tables);
  console.log(after.length === 0 ? "\n✔ Database is now identical to the backup." : `\n✘ Remaining differences: ${JSON.stringify(after.map((d) => [d.name, d.added.length, d.removed.length, d.changed.length]))}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
