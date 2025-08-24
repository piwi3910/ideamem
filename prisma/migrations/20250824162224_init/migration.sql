-- CreateTable
CREATE TABLE "config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "qdrantUrl" TEXT NOT NULL DEFAULT 'http://localhost:6333',
    "ollamaUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gitRepo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "indexProgress" INTEGER NOT NULL DEFAULT 0,
    "indexedAt" DATETIME,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "vectorCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexedCommit" TEXT,
    "lastIndexedBranch" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastWebhookAt" DATETIME,
    "lastWebhookCommit" TEXT,
    "lastWebhookBranch" TEXT,
    "lastWebhookAuthor" TEXT,
    "scheduledIndexingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledIndexingBranch" TEXT NOT NULL DEFAULT 'main',
    "scheduledIndexingInterval" INTEGER NOT NULL DEFAULT 60,
    "scheduledIndexingNextRun" DATETIME,
    "scheduledIndexingLastRun" DATETIME,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "lastQueryAt" DATETIME,
    "queriesThisWeek" INTEGER NOT NULL DEFAULT 0,
    "queriesThisMonth" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "indexing_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentFile" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "vectorsAdded" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "fullReindex" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "indexing_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_token_key" ON "projects"("token");
