-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL', 'PRE_RESET', 'PRE_RESTORE');

-- CreateTable
CREATE TABLE "DatabaseBackup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "BackupKind" NOT NULL,
    "trigger" TEXT NOT NULL,
    "actorId" TEXT,
    "label" TEXT,
    "schemaVersion" TEXT,
    "appCommit" TEXT,
    "tableCounts" JSONB NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "rawBytes" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'db',
    "blobUrl" TEXT,
    "blobPath" TEXT,
    "data" BYTEA,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatabaseBackup_createdAt_idx" ON "DatabaseBackup"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "DatabaseBackup_kind_createdAt_idx" ON "DatabaseBackup"("kind", "createdAt" DESC);
