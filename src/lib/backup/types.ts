/** Shape of a logical backup payload (before gzip). Format is versioned so
 *  the restore tool can refuse payloads it does not understand. */
export const BACKUP_FORMAT = "palhak-backup";
export const BACKUP_FORMAT_VERSION = 1;

export type BackupColumn = {
  name: string;
  /** information_schema.columns.data_type, e.g. "text", "ARRAY", "USER-DEFINED" */
  dataType: string;
  /** information_schema.columns.udt_name, e.g. "_text", "Role", "jsonb" */
  udtName: string;
  nullable: boolean;
};

export type BackupTable = {
  name: string;
  columns: BackupColumn[];
  rows: Record<string, unknown>[];
};

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_FORMAT_VERSION;
  createdAt: string;
  databaseHost: string | null;
  schemaVersion: string | null;
  appCommit: string | null;
  /** Tables in dependency order (parents before children). Restore inserts in this order. */
  tableOrder: string[];
  tables: Record<string, BackupTable>;
};

export type BackupSummary = {
  id: string;
  createdAt: string;
  kind: string;
  trigger: string;
  label: string | null;
  schemaVersion: string | null;
  appCommit: string | null;
  tableCounts: Record<string, number>;
  totalRows: number;
  rawBytes: number;
  sizeBytes: number;
  checksum: string;
  storage: string;
  blobUrl: string | null;
  verifiedAt: string | null;
  hasInlineData: boolean;
};

/** Tables that are never dumped (they contain the backups themselves). */
export const EXCLUDED_TABLES = new Set<string>(["DatabaseBackup"]);
/** Tables dumped for reference but never restored. */
export const REFERENCE_ONLY_TABLES = new Set<string>(["_prisma_migrations"]);
