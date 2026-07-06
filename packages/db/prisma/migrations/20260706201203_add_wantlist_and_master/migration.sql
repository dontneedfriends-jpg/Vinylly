-- AlterTable
ALTER TABLE "Release" ADD COLUMN "masterId" INTEGER;

-- CreateTable
CREATE TABLE "WantlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notes" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releaseId" TEXT NOT NULL,
    CONSTRAINT "WantlistEntry_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WantlistEntry_releaseId_idx" ON "WantlistEntry"("releaseId");

-- CreateIndex
CREATE INDEX "WantlistEntry_addedAt_idx" ON "WantlistEntry"("addedAt");

-- CreateIndex
CREATE INDEX "Release_masterId_idx" ON "Release"("masterId");
