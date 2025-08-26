-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_global_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'tooling',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_global_preferences" ("content", "createdAt", "id", "source", "updatedAt") SELECT "content", "createdAt", "id", "source", "updatedAt" FROM "global_preferences";
DROP TABLE "global_preferences";
ALTER TABLE "new_global_preferences" RENAME TO "global_preferences";
CREATE UNIQUE INDEX "global_preferences_source_key" ON "global_preferences"("source");
CREATE TABLE "new_global_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'rule',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_global_rules" ("content", "createdAt", "id", "source", "updatedAt") SELECT "content", "createdAt", "id", "source", "updatedAt" FROM "global_rules";
DROP TABLE "global_rules";
ALTER TABLE "new_global_rules" RENAME TO "global_rules";
CREATE UNIQUE INDEX "global_rules_source_key" ON "global_rules"("source");
CREATE TABLE "new_project_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'tooling',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_preferences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_project_preferences" ("content", "createdAt", "id", "projectId", "source", "updatedAt") SELECT "content", "createdAt", "id", "projectId", "source", "updatedAt" FROM "project_preferences";
DROP TABLE "project_preferences";
ALTER TABLE "new_project_preferences" RENAME TO "project_preferences";
CREATE UNIQUE INDEX "project_preferences_projectId_source_key" ON "project_preferences"("projectId", "source");
CREATE TABLE "new_project_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'rule',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_project_rules" ("content", "createdAt", "id", "projectId", "source", "updatedAt") SELECT "content", "createdAt", "id", "projectId", "source", "updatedAt" FROM "project_rules";
DROP TABLE "project_rules";
ALTER TABLE "new_project_rules" RENAME TO "project_rules";
CREATE UNIQUE INDEX "project_rules_projectId_source_key" ON "project_rules"("projectId", "source");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
