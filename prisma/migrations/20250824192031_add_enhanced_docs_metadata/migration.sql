-- CreateTable
CREATE TABLE "doc_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "language" TEXT,
    "lastUpdated" DATETIME,
    "author" TEXT,
    "version" TEXT,
    "confidenceScore" REAL,
    "title" TEXT,
    "description" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "requiresDynamicRendering" BOOLEAN NOT NULL DEFAULT false,
    "renderingEngine" TEXT,
    "lastCrawled" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "crawlDuration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "code_examples" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "codeContent" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "context" TEXT,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "imports" TEXT,
    "functions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "code_examples_docId_fkey" FOREIGN KEY ("docId") REFERENCES "doc_metadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_relationships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDocId" TEXT NOT NULL,
    "targetDocId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 0.0,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_relationships_sourceDocId_fkey" FOREIGN KEY ("sourceDocId") REFERENCES "doc_metadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "content_relationships_targetDocId_fkey" FOREIGN KEY ("targetDocId") REFERENCES "doc_metadata" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "search_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryHash" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "lastHit" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "content_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "urlHash" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "parsedContent" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "lastModified" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_metadata_sourceUrl_key" ON "doc_metadata"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "content_relationships_sourceDocId_targetDocId_relationshipType_key" ON "content_relationships"("sourceDocId", "targetDocId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "search_cache_queryHash_key" ON "search_cache"("queryHash");

-- CreateIndex
CREATE UNIQUE INDEX "content_cache_urlHash_key" ON "content_cache"("urlHash");
