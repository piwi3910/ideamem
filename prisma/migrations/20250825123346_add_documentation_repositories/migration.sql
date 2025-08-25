-- CreateTable
CREATE TABLE "documentation_repositories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "sourceType" TEXT NOT NULL DEFAULT 'git',
    "lastIndexedCommit" TEXT,
    "lastIndexedAt" DATETIME,
    "autoReindexEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reindexInterval" INTEGER NOT NULL DEFAULT 1440,
    "nextReindexAt" DATETIME,
    "description" TEXT,
    "language" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "lastIndexingDuration" INTEGER,
    "lastIndexingStatus" TEXT,
    "lastIndexingError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "qdrantUrl" TEXT NOT NULL DEFAULT 'http://localhost:6333',
    "ollamaUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "docReindexEnabled" BOOLEAN NOT NULL DEFAULT false,
    "docReindexInterval" INTEGER NOT NULL DEFAULT 1440,
    "docReindexNextRun" DATETIME,
    "docReindexLastRun" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_config" ("createdAt", "id", "ollamaUrl", "qdrantUrl", "updatedAt") SELECT "createdAt", "id", "ollamaUrl", "qdrantUrl", "updatedAt" FROM "config";
DROP TABLE "config";
ALTER TABLE "new_config" RENAME TO "config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "documentation_repositories_name_key" ON "documentation_repositories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "documentation_repositories_url_key" ON "documentation_repositories"("url");
