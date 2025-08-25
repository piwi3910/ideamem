-- CreateTable
CREATE TABLE "search_index" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentHash" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "complexity" TEXT NOT NULL DEFAULT 'medium',
    "freshness" REAL NOT NULL DEFAULT 1.0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSearched" DATETIME
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "filters" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "searchTime" INTEGER NOT NULL DEFAULT 0,
    "clickedResult" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "search_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestion" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatedTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" TEXT,
    "name" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "search_index_contentHash_key" ON "search_index"("contentHash");

-- CreateIndex
CREATE INDEX "search_queries_queryHash_idx" ON "search_queries"("queryHash");

-- CreateIndex
CREATE INDEX "search_queries_createdAt_idx" ON "search_queries"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "search_suggestions_suggestion_key" ON "search_suggestions"("suggestion");

-- CreateIndex
CREATE INDEX "search_suggestions_category_idx" ON "search_suggestions"("category");

-- CreateIndex
CREATE INDEX "search_suggestions_searchCount_idx" ON "search_suggestions"("searchCount");

-- CreateIndex
CREATE INDEX "saved_searches_sessionId_idx" ON "saved_searches"("sessionId");

-- CreateIndex
CREATE INDEX "saved_searches_lastUsed_idx" ON "saved_searches"("lastUsed");
