-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "qdrantUrl" TEXT NOT NULL DEFAULT 'http://localhost:6333',
    "ollamaUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "logLevel" TEXT NOT NULL DEFAULT 'debug',
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
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
