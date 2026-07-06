-- AlterTable
ALTER TABLE "Item" ADD COLUMN "discogsInstanceId" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "styles" TEXT NOT NULL DEFAULT '[]',
    "coverPath" TEXT,
    "thumbPath" TEXT,
    "coverRemote" TEXT,
    "thumbRemote" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Release" ("artist", "coverPath", "coverRemote", "createdAt", "genres", "id", "source", "sourceId", "styles", "thumbPath", "thumbRemote", "title", "updatedAt", "year") SELECT "artist", "coverPath", "coverRemote", "createdAt", "genres", "id", "source", "sourceId", "styles", "thumbPath", "thumbRemote", "title", "updatedAt", "year" FROM "Release";
DROP TABLE "Release";
ALTER TABLE "new_Release" RENAME TO "Release";
CREATE INDEX "Release_artist_idx" ON "Release"("artist");
CREATE INDEX "Release_title_idx" ON "Release"("title");
CREATE UNIQUE INDEX "Release_source_sourceId_key" ON "Release"("source", "sourceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
