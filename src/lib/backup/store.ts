import { BackupKind, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dumpDatabase, serializePayload, sha256, parsePayload } from "./dump";
import { blobConfigured, deleteBackupFromBlob, downloadBackupFromBlob, uploadBackupToBlob } from "./blob";
import type { BackupSummary } from "./types";

/**
 * Retention policy. The requirement was "at least 3 daily versions in a row and
 * one month back"; we keep considerably more because backups are small
 * (a few hundred KB gzipped).
 */
export const RETENTION: Record<BackupKind, { days: number | null }> = {
  DAILY: { days: 14 },
  WEEKLY: { days: 70 },      // 10 weeks
  MONTHLY: { days: 400 },    // ~13 months
  MANUAL: { days: 365 },
  PRE_RESET: { days: null }, // never auto-pruned
  PRE_RESTORE: { days: null },
};

/** Hard cap for inline (in-DB) backup bytes. Oldest DAILY/WEEKLY go first. */
export const MAX_INLINE_BYTES = 250 * 1024 * 1024;

/** Which kind an automatic run should produce today (UTC). */
export function kindForDate(d = new Date()): BackupKind {
  if (d.getUTCDate() === 1) return BackupKind.MONTHLY;
  if (d.getUTCDay() === 0) return BackupKind.WEEKLY;
  return BackupKind.DAILY;
}

function expiresFor(kind: BackupKind, from: Date): Date | null {
  const days = RETENTION[kind].days;
  if (days === null) return null;
  return new Date(from.getTime() + days * 86_400_000);
}

export type CreateBackupOptions = {
  kind: BackupKind;
  trigger: "cron" | "manual" | "pre-reset" | "pre-restore" | "script";
  actorId?: string | null;
  label?: string | null;
  /** Also upload to Vercel Blob when configured (default true). */
  mirror?: boolean;
};

export type CreateBackupResult = {
  id: string;
  kind: BackupKind;
  sizeBytes: number;
  rawBytes: number;
  totalRows: number;
  tableCounts: Record<string, number>;
  checksum: string;
  blobUrl: string | null;
  mirrorError: string | null;
};

export async function createBackup(opts: CreateBackupOptions): Promise<CreateBackupResult> {
  const payload = await dumpDatabase(prisma);
  const { raw, gz, checksum, tableCounts, totalRows } = serializePayload(payload);
  const now = new Date();

  let blobUrl: string | null = null;
  let blobPath: string | null = null;
  let mirrorError: string | null = null;
  if (opts.mirror !== false && blobConfigured()) {
    try {
      const stamp = now.toISOString().replace(/[:.]/g, "-");
      const up = await uploadBackupToBlob(`palhak-backups/${opts.kind.toLowerCase()}/${stamp}.json.gz`, gz);
      if (up) {
        blobUrl = up.url;
        blobPath = up.pathname;
      }
    } catch (e) {
      mirrorError = e instanceof Error ? e.message : String(e);
    }
  }

  const row = await prisma.databaseBackup.create({
    data: {
      kind: opts.kind,
      trigger: opts.trigger,
      actorId: opts.actorId ?? null,
      label: opts.label ?? null,
      schemaVersion: payload.schemaVersion,
      appCommit: payload.appCommit,
      tableCounts: tableCounts as Prisma.InputJsonValue,
      totalRows,
      rawBytes: raw.length,
      sizeBytes: gz.length,
      checksum,
      storage: blobUrl ? "db+blob" : "db",
      blobUrl,
      blobPath,
      data: new Uint8Array(gz),
      expiresAt: expiresFor(opts.kind, now),
      verifiedAt: now, // freshly serialized and hashed
    },
    select: { id: true },
  });

  return {
    id: row.id,
    kind: opts.kind,
    sizeBytes: gz.length,
    rawBytes: raw.length,
    totalRows,
    tableCounts,
    checksum,
    blobUrl,
    mirrorError,
  };
}

/** Remove expired backups and enforce the inline size cap. Returns ids removed. */
export async function pruneBackups(now = new Date()): Promise<string[]> {
  const removed: string[] = [];

  const expired = await prisma.databaseBackup.findMany({
    where: { expiresAt: { not: null, lt: now } },
    select: { id: true, blobUrl: true },
  });
  for (const b of expired) {
    if (b.blobUrl) {
      try {
        await deleteBackupFromBlob(b.blobUrl);
      } catch {
        /* keep going; a dangling blob is harmless */
      }
    }
    await prisma.databaseBackup.delete({ where: { id: b.id } });
    removed.push(b.id);
  }

  // Size cap: drop oldest DAILY, then WEEKLY, inline copies (keep the row + blob).
  const all = await prisma.databaseBackup.findMany({
    where: { data: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, sizeBytes: true },
  });
  let total = all.reduce((s, b) => s + b.sizeBytes, 0);
  for (const kind of [BackupKind.DAILY, BackupKind.WEEKLY]) {
    for (const b of all) {
      if (total <= MAX_INLINE_BYTES) break;
      if (b.kind !== kind) continue;
      await prisma.databaseBackup.update({
        where: { id: b.id },
        data: { data: null, storage: "pruned-inline" },
      });
      total -= b.sizeBytes;
    }
  }
  return removed;
}

export async function listBackups(limit = 100): Promise<BackupSummary[]> {
  const rows = await prisma.databaseBackup.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      kind: true,
      trigger: true,
      label: true,
      schemaVersion: true,
      appCommit: true,
      tableCounts: true,
      totalRows: true,
      rawBytes: true,
      sizeBytes: true,
      checksum: true,
      storage: true,
      blobUrl: true,
      verifiedAt: true,
    },
  });
  const hasData = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "DatabaseBackup" WHERE "data" IS NOT NULL
  `;
  const withData = new Set(hasData.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    kind: r.kind,
    trigger: r.trigger,
    label: r.label,
    schemaVersion: r.schemaVersion,
    appCommit: r.appCommit,
    tableCounts: (r.tableCounts ?? {}) as Record<string, number>,
    totalRows: r.totalRows,
    rawBytes: r.rawBytes,
    sizeBytes: r.sizeBytes,
    checksum: r.checksum,
    storage: r.storage,
    blobUrl: r.blobUrl,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    hasInlineData: withData.has(r.id),
  }));
}

/** Returns the gzipped payload bytes, from the DB copy or the Blob mirror. */
export async function getBackupBytes(id: string): Promise<{ gz: Buffer; checksum: string; createdAt: Date; kind: BackupKind } | null> {
  const row = await prisma.databaseBackup.findUnique({
    where: { id },
    select: { data: true, blobUrl: true, checksum: true, createdAt: true, kind: true },
  });
  if (!row) return null;
  let gz: Buffer | null = row.data ? Buffer.from(row.data) : null;
  if (!gz && row.blobUrl) gz = await downloadBackupFromBlob(row.blobUrl);
  if (!gz) return null;
  return { gz, checksum: row.checksum, createdAt: row.createdAt, kind: row.kind };
}

export type VerifyResult = {
  ok: boolean;
  checksumOk: boolean;
  parseOk: boolean;
  countsOk: boolean;
  problems: string[];
};

/** Integrity check: hash matches, payload parses, row counts match the manifest. */
export async function verifyBackup(id: string): Promise<VerifyResult> {
  const problems: string[] = [];
  const row = await prisma.databaseBackup.findUnique({
    where: { id },
    select: { checksum: true, tableCounts: true },
  });
  if (!row) return { ok: false, checksumOk: false, parseOk: false, countsOk: false, problems: ["backup not found"] };
  const bytes = await getBackupBytes(id);
  if (!bytes) return { ok: false, checksumOk: false, parseOk: false, countsOk: false, problems: ["no data available (inline copy pruned and no blob mirror)"] };

  const checksumOk = sha256(bytes.gz) === row.checksum;
  if (!checksumOk) problems.push("checksum mismatch");

  let parseOk = false;
  let countsOk = false;
  try {
    const payload = parsePayload(bytes.gz);
    parseOk = true;
    const expected = (row.tableCounts ?? {}) as Record<string, number>;
    countsOk = true;
    for (const [table, n] of Object.entries(expected)) {
      const actual = payload.tables[table]?.rows.length ?? -1;
      if (actual !== n) {
        countsOk = false;
        problems.push(`${table}: expected ${n} rows, found ${actual}`);
      }
    }
  } catch (e) {
    problems.push(`parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const ok = checksumOk && parseOk && countsOk;
  if (ok) {
    await prisma.databaseBackup.update({ where: { id }, data: { verifiedAt: new Date() } });
  }
  return { ok, checksumOk, parseOk, countsOk, problems };
}

/** Age of the newest automatic backup, in hours (Infinity if none). */
export async function hoursSinceLastAutomaticBackup(): Promise<number> {
  const last = await prisma.databaseBackup.findFirst({
    where: { trigger: "cron" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return Number.POSITIVE_INFINITY;
  return (Date.now() - last.createdAt.getTime()) / 3_600_000;
}
