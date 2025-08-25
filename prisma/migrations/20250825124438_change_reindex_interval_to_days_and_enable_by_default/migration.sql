-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "qdrantUrl" TEXT NOT NULL DEFAULT 'http://localhost:6333',
    "ollamaUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "docReindexEnabled" BOOLEAN NOT NULL DEFAULT true,
    "docReindexInterval" INTEGER NOT NULL DEFAULT 14,
    "docReindexNextRun" DATETIME,
    "docReindexLastRun" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_config" ("createdAt", "docReindexEnabled", "docReindexInterval", "docReindexLastRun", "docReindexNextRun", "id", "ollamaUrl", "qdrantUrl", "updatedAt") SELECT "createdAt", "docReindexEnabled", "docReindexInterval", "docReindexLastRun", "docReindexNextRun", "id", "ollamaUrl", "qdrantUrl", "updatedAt" FROM "config";
DROP TABLE "config";
ALTER TABLE "new_config" RENAME TO "config";
CREATE TABLE "new_documentation_repositories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "sourceType" TEXT NOT NULL DEFAULT 'git',
    "lastIndexedCommit" TEXT,
    "lastIndexedAt" DATETIME,
    "autoReindexEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reindexInterval" INTEGER NOT NULL DEFAULT 14,
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
INSERT INTO "new_documentation_repositories" ("autoReindexEnabled", "branch", "createdAt", "description", "id", "isActive", "language", "lastIndexedAt", "lastIndexedCommit", "lastIndexingDuration", "lastIndexingError", "lastIndexingStatus", "name", "nextReindexAt", "reindexInterval", "sourceType", "totalDocuments", "updatedAt", "url") SELECT "autoReindexEnabled", "branch", "createdAt", "description", "id", "isActive", "language", "lastIndexedAt", "lastIndexedCommit", "lastIndexingDuration", "lastIndexingError", "lastIndexingStatus", "name", "nextReindexAt", "reindexInterval", "sourceType", "totalDocuments", "updatedAt", "url" FROM "documentation_repositories";
DROP TABLE "documentation_repositories";
ALTER TABLE "new_documentation_repositories" RENAME TO "documentation_repositories";
CREATE UNIQUE INDEX "documentation_repositories_name_key" ON "documentation_repositories"("name");
CREATE UNIQUE INDEX "documentation_repositories_url_key" ON "documentation_repositories"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
