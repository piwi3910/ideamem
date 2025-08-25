-- CreateTable
CREATE TABLE "documentation_indexing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "processedDocuments" INTEGER NOT NULL DEFAULT 0,
    "documentsAdded" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "sourceType" TEXT NOT NULL DEFAULT 'git',
    "forceReindex" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "documentation_indexing_jobs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "documentation_repositories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
