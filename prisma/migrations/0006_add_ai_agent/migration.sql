-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PROPOSED', 'EXECUTING', 'DONE', 'PARTIAL', 'FAILED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "RequestItem" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "BoxItem" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "viaAgentRunId" TEXT;

-- AlterTable
ALTER TABLE "TashLog" ADD COLUMN     "viaAgentRunId" TEXT;

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PROPOSED',
    "userPrompt" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "receipt" JSONB,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTurn" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheTokens" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_actorId_createdAt_idx" ON "AgentRun"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentTurn_actorId_createdAt_idx" ON "AgentTurn"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTurn" ADD CONSTRAINT "AgentTurn_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

