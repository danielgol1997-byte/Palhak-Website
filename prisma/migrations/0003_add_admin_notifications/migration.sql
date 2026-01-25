-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "itemsSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_dismissed_createdAt_idx" ON "AdminNotification"("dismissed", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_requestId_idx" ON "AdminNotification"("requestId");
