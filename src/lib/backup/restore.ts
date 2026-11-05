import type { PrismaClient } from "@prisma/client";
import { REFERENCE_ONLY_TABLES, EXCLUDED_TABLES, type BackupPayload } from "./types";
import { listTables, foreignKeyEdges, topoSort } from "./dump";

type Db = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe" | "$queryRaw" | "$transaction">;

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier ${name}`);
  return `"${name}"`;
}

export type RestorePlan = {
  tablesToRestore: string[];
  tablesSkipped: { name: string; reason: string }[];
  rowCounts: Record<string, number>;
  /** Columns present in the backup but missing in the live schema (will be dropped). */
  droppedColumns: Record<string, string[]>;
  /** Columns present live but missing in the backup (will be NULL/default). */
  missingColumns: Record<string, string[]>;
};

/** Compare a payload with the live schema and describe what a restore would do. */
export async function planRestore(db: Db, payload: BackupPayload): Promise<RestorePlan> {
  const liveTables = new Set(await listTables(db));
  const edges = await foreignKeyEdges(db);
  const tablesSkipped: RestorePlan["tablesSkipped"] = [];
  const candidates: string[] = [];
  for (const name of payload.tableOrder) {
    if (EXCLUDED_TABLES.has(name)) continue;
    if (REFERENCE_ONLY_TABLES.has(name)) {
      tablesSkipped.push({ name, reason: "reference only (migration history is managed by Prisma)" });
      continue;
    }
    if (!liveTables.has(name)) {
      tablesSkipped.push({ name, reason: "table no longer exists in the live schema" });
      continue;
    }
    candidates.push(name);
  }
  const ordered = topoSort(candidates, edges);

  const droppedColumns: Record<string, string[]> = {};
  const missingColumns: Record<string, string[]> = {};
  const rowCounts: Record<string, number> = {};
  for (const name of ordered) {
    const live = await db.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      name
    );
    const liveCols = new Set(live.map((c) => c.column_name));
    const backupCols = new Set(payload.tables[name]!.columns.map((c) => c.name));
    const dropped = [...backupCols].filter((c) => !liveCols.has(c));
    const missing = [...liveCols].filter((c) => !backupCols.has(c));
    if (dropped.length) droppedColumns[name] = dropped;
    if (missing.length) missingColumns[name] = missing;
    rowCounts[name] = payload.tables[name]!.rows.length;
  }
  return { tablesToRestore: ordered, tablesSkipped, rowCounts, droppedColumns, missingColumns };
}

const CHUNK = 500;

/**
 * Replace the contents of every table in the plan with the rows from the payload.
 * Runs inside ONE transaction: either everything is restored or nothing changes.
 * Uses json_populate_recordset so Postgres performs all type casts (enums, arrays,
 * timestamps, jsonb) from the JSON values.
 */
export async function executeRestore(
  db: PrismaClient,
  payload: BackupPayload,
  plan: RestorePlan,
  log: (msg: string) => void = () => {}
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const idents = plan.tablesToRestore.map(quoteIdent).join(", ");
      log(`TRUNCATE ${plan.tablesToRestore.length} tables`);
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${idents} RESTART IDENTITY CASCADE`);

      for (const name of plan.tablesToRestore) {
        const table = payload.tables[name]!;
        const dropped = new Set(plan.droppedColumns[name] ?? []);
        const rows = dropped.size
          ? table.rows.map((r) => {
              const copy: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(r)) if (!dropped.has(k)) copy[k] = v;
              return copy;
            })
          : table.rows;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          await tx.$executeRawUnsafe(
            `INSERT INTO ${quoteIdent(name)} SELECT * FROM json_populate_recordset(NULL::${quoteIdent(name)}, $1::json)`,
            JSON.stringify(chunk)
          );
        }
        log(`${name}: ${rows.length} rows`);
      }
    },
    { timeout: 10 * 60_000, maxWait: 30_000 }
  );
}
