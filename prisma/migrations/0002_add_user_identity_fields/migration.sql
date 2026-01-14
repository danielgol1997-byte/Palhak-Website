-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "personalNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_personalNumber_key" ON "User"("personalNumber");




