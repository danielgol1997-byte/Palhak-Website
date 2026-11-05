import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import type { PrismaClient } from "@prisma/client";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  EXCLUDED_TABLES,
  type BackupColumn,
  type BackupPayload,
  type BackupTable,
} from "./types";

type Db = Pick<PrismaClient, "$queryRawUnsafe" | "$queryRaw">;

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

/** All base tables in the public schema (excluding backup storage). */
export async function listTables(db: Db): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((r) => r.table_name).filter((t) => !EXCLUDED_TABLES.has(t));
}

export async function listColumns(db: Db, table: string): Promise<BackupColumn[]> {
  const rows = await db.$queryRawUnsafe<
    { column_name: string; data_type: string; udt_name: string; is_nullable: string }[]
  >(
    `SELECT column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    table
  );
  return rows.map((r) => ({
    name: r.column_name,
    dataType: r.data_type,
    udtName: r.udt_name,
    nullable: r.is_nullable === "YES",
  }));
}

/** child -> parents map from FK constraints. */
export async function foreignKeyEdges(db: Db): Promise<Map<string, Set<string>>> {
  const rows = await db.$queryRawUnsafe<{ child: string; parent: string }[]>(
    `SELECT DISTINCT tc.table_name AS child, ccu.table_name AS parent
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.child === r.parent) continue;
    if (!map.has(r.child)) map.set(r.child, new Set());
    map.get(r.child)!.add(r.parent);
  }
  return map;
}

/** Parents first. Stable (alphabetical) among independent tables. */
export function topoSort(tables: string[], edges: Map<string, Set<string>>): string[] {
  const remaining = new Set(tables);
  const out: string[] = [];
  let guard = 0;
  while (remaining.size > 0) {
    if (++guard > 10_000) throw new Error("Cycle detected while ordering tables");
    const ready = [...remaining]
      .filter((t) => [...(edges.get(t) ?? [])].every((p) => !remaining.has(p) || !tables.includes(p)))
      .sort();
    if (ready.length === 0) {
      // Break a cycle deterministically (should not happen with this schema).
      const t = [...remaining].sort()[0]!;
      out.push(t);
      remaining.delete(t);
      continue;
    }
    for (const t of ready) {
      out.push(t);
      remaining.delete(t);
    }
  }
  return out;
}

async function latestMigrationName(db: Db): Promise<string | null> {
  try {
    const rows = await db.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
    );
    return rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
}

function dbHostFromEnv(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Read every table into memory. The database is small (tens of MB) so this is fine. */
export async function dumpDatabase(db: Db): Promise<BackupPayload> {
  const tables = await listTables(db);
  const edges = await foreignKeyEdges(db);
  const order = topoSort(tables, edges);

  const out: Record<string, BackupTable> = {};
  for (const name of order) {
    const columns = await listColumns(db, name);
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${quoteIdent(name)}`
    );
    out[name] = { name, columns, rows };
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    databaseHost: dbHostFromEnv(),
    schemaVersion: await latestMigrationName(db),
    appCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    tableOrder: order,
    tables: out,
  };
}

export function serializePayload(payload: BackupPayload): {
  raw: Buffer;
  gz: Buffer;
  checksum: string;
  tableCounts: Record<string, number>;
  totalRows: number;
} {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const gz = gzipSync(raw, { level: 9 });
  const checksum = createHash("sha256").update(gz).digest("hex");
  const tableCounts: Record<string, number> = {};
  let totalRows = 0;
  for (const t of Object.values(payload.tables)) {
    tableCounts[t.name] = t.rows.length;
    totalRows += t.rows.length;
  }
  return { raw, gz, checksum, tableCounts, totalRows };
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function parsePayload(gz: Buffer): BackupPayload {
  const raw = gunzipSync(gz).toString("utf8");
  const parsed = JSON.parse(raw) as BackupPayload;
  if (parsed.format !== BACKUP_FORMAT) throw new Error("Not a Palhak backup file");
  if (parsed.version !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Unsupported backup format version ${parsed.version}`);
  }
  if (!parsed.tables || !Array.isArray(parsed.tableOrder)) throw new Error("Corrupt backup payload");
  return parsed;
}
