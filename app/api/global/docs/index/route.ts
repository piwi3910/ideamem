import { MiddlewareStacks } from '@/lib/middleware/compose';
import { NextResponse, NextRequest } from 'next/server';
import { readdir, readFile, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { ingest } from '@/lib/memory';
import { parserFactory } from '@/lib/parsing';
import simpleGit from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { prisma } from '@/lib/database';
import { shouldUseDynamicRendering, dynamicRenderer } from '@/lib/dynamic-renderer';
import { ParsedContentCache } from '@/lib/cache';
import { ContentClassifier } from '@/lib/content-classifier';
import { HybridSearchEngine } from '@/lib/hybrid-search';
import { QueueManager, JOB_PRIORITIES } from '@/lib/queue';

interface DocRepository {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  url: string;
  branch?: string;
  description?: string;
  languages: string[];
  lastIndexed?: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  documentCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

// Initialize Prisma client
// Using singleton from @/lib/database

async function getRepository(repositoryId: string): Promise<DocRepository | null> {
  try {
    const repo = await prisma.documentationRepository.findUnique({
      where: { id: repositoryId }
    });
    
    if (!repo) return null;
    
    return {
      id: repo.id,
      name: repo.name,
      sourceType: repo.sourceType as 'git' | 'llmstxt' | 'website',
      url: repo.url,
      branch: repo.branch,
      description: repo.description || undefined,
      languages: repo.language ? [repo.language] : [],
      lastIndexed: repo.lastIndexedAt?.toISOString(),
      status: (repo.lastIndexingStatus?.toLowerCase() || 'pending') as 'pending' | 'indexing' | 'completed' | 'error',
      documentCount: repo.totalDocuments,
      lastError: repo.lastIndexingError || undefined,
      createdAt: repo.createdAt.toISOString(),
      updatedAt: repo.updatedAt.toISOString()
    };
  } catch (error) {
    console.error('Error loading repository:', error);
    return null;
  }
}

async function updateRepositoryStatus(
  id: string,
  status: DocRepository['status'],
  documentCount?: number,
  error?: string
) {
  try {
    await prisma.documentationRepository.update({
      where: { id },
      data: {
        lastIndexingStatus: status.toUpperCase(),
        totalDocuments: documentCount ?? undefined,
        lastIndexingError: error || null,
        lastIndexedAt: status === 'completed' ? new Date() : undefined,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error(`Failed to update repository status for ${id}:`, error);
  }
}

// Documentation file patterns to search for
const DOC_PATTERNS = [
  // README files
  'README.md',
  'README.rst',
  'README.txt',
  'readme.md',
  // Documentation directories
  'docs/**/*.md',
  'docs/**/*.rst',
  'documentation/**/*.md',
  // API documentation
  'api.md',
  'API.md',
  'api/**/*.md',
  // Getting started guides
  'getting-started.md',
  'quickstart.md',
  'tutorial.md',
  // Examples
  'examples/**/*.md',
  'example/**/*.md',
  // Changelog and migration
  'CHANGELOG.md',
  'changelog.md',
  'MIGRATION.md',
  // Contributing guides
  'CONTRIBUTING.md',
  'contributing.md',
];

// Code file patterns for extracting examples
const CODE_PATTERNS = [
  'examples/**/*.js',
  'examples/**/*.ts',
  'examples/**/*.jsx',
  'examples/**/*.tsx',
  'example/**/*.js',
  'example/**/*.ts',
  'example/**/*.jsx',
  'example/**/*.tsx',
  'demo/**/*.js',
  'demo/**/*.ts',
  'demo/**/*.jsx',
  'demo/**/*.tsx',
  'src/**/*.example.js',
  'src/**/*.example.ts',
  '*.config.js',
  '*.config.ts',
];

async function findDocumentationFiles(repoPath: string): Promise<string[]> {
  const foundFiles: string[] = [];

  const searchPatterns = async (patterns: string[], basePath: string) => {
    for (const pattern of patterns) {
      try {
        if (pattern.includes('**')) {
          // Handle glob patterns by recursively searching
          const parts = pattern.split('/');
          const searchDir = parts[0] === '**' ? basePath : path.join(basePath, parts[0]);

          if (existsSync(searchDir)) {
            const files = await findFilesRecursively(searchDir, pattern.split('/').pop()!);
            foundFiles.push(...files);
          }
        } else {
          // Handle direct file patterns
          const filePath = path.join(basePath, pattern);
          if (existsSync(filePath)) {
            const stats = await stat(filePath);
            if (stats.isFile()) {
              foundFiles.push(filePath);
            }
          }
        }
      } catch (_error) {
        // Skip files that can't be accessed
      }
    }
  };

  await searchPatterns(DOC_PATTERNS, repoPath);
  await searchPatterns(CODE_PATTERNS, repoPath);

  return Array.from(new Set(foundFiles)); // Remove duplicates
}

async function findFilesRecursively(dir: string, pattern: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories we don't want to index
        if (['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
          continue;
        }
        const subResults = await findFilesRecursively(fullPath, pattern);
        results.push(...subResults);
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (pattern === '*.md' && entry.name.endsWith('.md')) {
          results.push(fullPath);
        } else if (pattern === '*.rst' && entry.name.endsWith('.rst')) {
          results.push(fullPath);
        } else if (pattern === '*.js' && entry.name.endsWith('.js')) {
          results.push(fullPath);
        } else if (pattern === '*.ts' && entry.name.endsWith('.ts')) {
          results.push(fullPath);
        } else if (entry.name === pattern) {
          results.push(fullPath);
        }
      }
    }
  } catch (_error) {
    // Skip directories that can't be read
  }

  return results;
}

function detectFileType(filePath: string): { language: string; type: 'documentation' | 'code' } {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  // Documentation files
  if (ext === '.md') return { language: 'markdown', type: 'documentation' };
  if (ext === '.rst') return { language: 'rst', type: 'documentation' };
  if (ext === '.txt' && basename.includes('readme'))
    return { language: 'text', type: 'documentation' };

  // Code files
  if (ext === '.js') return { language: 'javascript', type: 'code' };
  if (ext === '.ts') return { language: 'typescript', type: 'code' };
  if (ext === '.jsx') return { language: 'javascript', type: 'code' };
  if (ext === '.tsx') return { language: 'typescript', type: 'code' };
  if (ext === '.py') return { language: 'python', type: 'code' };
  if (ext === '.go') return { language: 'go', type: 'code' };
  if (ext === '.java') return { language: 'java', type: 'code' };
  if (ext === '.rs') return { language: 'rust', type: 'code' };

  return { language: 'text', type: 'documentation' };
}

// Real indexing implementation for different source types
async function indexDocumentationSource(
  repo: DocRepository
): Promise<{ success: boolean; documentCount: number; error?: string }> {
  switch (repo.sourceType) {
    case 'git':
      return await indexGitRepository(repo);
    case 'llmstxt':
      return await indexLLMsTxtFile(repo);
    case 'website':
      return await indexWebsite(repo);
    default:
      return { success: false, documentCount: 0, error: `Unknown source type: ${repo.sourceType}` };
  }
}

// Git repository indexing implementation
async function indexGitRepository(
  repo: DocRepository
): Promise<{ success: boolean; documentCount: number; error?: string }> {
  let tempDir: string | null = null;

  try {
    // Create temporary directory for cloning
    tempDir = path.join(os.tmpdir(), `ideamem-clone-${uuidv4()}`);

    console.log(`Cloning repository ${repo.url} to ${tempDir}`);

    // Initialize simple-git and clone the repository
    const git = simpleGit();
    await git.clone(repo.url!, tempDir, ['--depth', '1', '--branch', repo.branch || 'main']);

    console.log('Repository cloned successfully, discovering documentation files...');

    // Find all documentation and example files
    const documentationFiles = await findDocumentationFiles(tempDir);

    console.log(`Found ${documentationFiles.length} documentation files to index`);

    let documentCount = 0;

    // Process each file
    for (const filePath of documentationFiles) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const relativePath = path.relative(tempDir, filePath);
        const fileInfo = detectFileType(filePath);

        // Skip empty files or very small files
        if (content.trim().length < 50) {
          continue;
        }

        // Parse the file content
        const result = parserFactory.parse(content, relativePath, fileInfo.language);

        if (result.success && result.chunks.length > 0) {
          // Ingest each chunk
          for (const chunk of result.chunks) {
            await ingest({
              content: chunk.content,
              source: `${repo.name}/${relativePath}`,
              type: fileInfo.type,
              language: fileInfo.language,
              project_id: 'global',
              scope: 'global',
            });
            documentCount++;
          }
        } else {
          // If parsing fails, ingest the raw content
          await ingest({
            content,
            source: `${repo.name}/${relativePath}`,
            type: fileInfo.type,
            language: fileInfo.language,
            project_id: 'global',
            scope: 'global',
          });
          documentCount++;
        }

        console.log(`Indexed: ${relativePath} (${fileInfo.language})`);
      } catch (fileError) {
        console.warn(`Failed to process file ${filePath}:`, fileError);
      }
    }

    console.log(`Successfully indexed ${documentCount} documents from ${repo.name}`);
    return { success: true, documentCount };
  } catch (error) {
    console.error('Error cloning and indexing repository:', error);
    return {
      success: false,
      documentCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Clean up temporary directory
    if (tempDir && existsSync(tempDir)) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary directory ${tempDir}:`, cleanupError);
      }
    }
  }
}

// POST - Index a documentation repository using queue system
export const POST = MiddlewareStacks.api(async (request: NextRequest) => {
  const body = await request.json();
  const { repositoryId } = body;

  if (!repositoryId) {
    return NextResponse.json(
      { success: false, error: 'Repository ID is required' },
      { status: 400 }
    );
  }

  const repo = await getRepository(repositoryId);

  if (!repo) {
    return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
  }

  // Update status to indexing
  await updateRepositoryStatus(repositoryId, 'indexing');

  // Create database record for tracking this indexing job
  let docIndexingJob;
    try {
      docIndexingJob = await prisma.documentationIndexingJob.create({
        data: {
          repositoryId,
          status: 'PENDING',
          branch: repo.branch || 'main',
          sourceType: repo.sourceType,
          forceReindex: false,
          triggeredBy: 'MANUAL'
        }
      });
    } catch (dbError) {
      console.error('Failed to create documentation indexing job record:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to create indexing job record' },
        { status: 500 }
      );
    }

    // Add indexing job to queue instead of running directly
    try {
      await QueueManager.addDocumentationIndexingJob({
        repositoryId,
        repositoryUrl: repo.url,
        branch: repo.branch || 'main',
        sourceType: repo.sourceType,
        forceReindex: false,
        jobId: docIndexingJob.id // Pass the database job ID to the queue
      }, JOB_PRIORITIES.NORMAL);

      // Update job status to running
      await prisma.documentationIndexingJob.update({
        where: { id: docIndexingJob.id },
        data: { status: 'RUNNING' }
      });

      console.log(`Added documentation indexing job for ${repo.name} to queue`);
    } catch (queueError) {
      console.error('Failed to add job to queue:', queueError);
      // Update database record with error
      await prisma.documentationIndexingJob.update({
        where: { id: docIndexingJob.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Failed to queue indexing job',
          completedAt: new Date()
        }
      });
      await updateRepositoryStatus(repositoryId, 'error', 0, 'Failed to queue indexing job');
      return NextResponse.json(
        { success: false, error: 'Failed to queue indexing job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Started indexing ${repo.name} via queue system`,
    });
});

// Index llms.txt file
async function indexLLMsTxtFile(
  repo: DocRepository
): Promise<{ success: boolean; documentCount: number; error?: string }> {
  try {
    console.log(`Indexing llms.txt file: ${repo.url}`);

    const response = await fetch(repo.url!);
    if (!response.ok) {
      throw new Error(`Failed to fetch llms.txt: ${response.status}`);
    }

    const content = await response.text();

    // Parse the llms.txt content using our parser
    const result = parserFactory.parse(content, `${repo.name}/llms.txt`, 'markdown');

    let documentCount = 0;

    if (result.success && result.chunks.length > 0) {
      // Ingest each chunk
      for (const chunk of result.chunks) {
        await ingest({
          content: chunk.content,
          source: `${repo.name}/llms.txt`,
          type: 'documentation',
          language: 'markdown',
          project_id: 'global',
          scope: 'global',
        });
        documentCount++;
      }
    } else {
      // If parsing fails, ingest the raw content
      await ingest({
        content,
        source: `${repo.name}/llms.txt`,
        type: 'documentation',
        language: 'markdown',
        project_id: 'global',
        scope: 'global',
      });
      documentCount = 1;
    }

    console.log(`Successfully indexed llms.txt file with ${documentCount} chunks`);
    return { success: true, documentCount };
  } catch (error) {
    console.error('Error indexing llms.txt file:', error);
    return {
      success: false,
      documentCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Index website content with comprehensive crawling
async function indexWebsite(
  repo: DocRepository
): Promise<{ success: boolean; documentCount: number; error?: string }> {
  try {
    console.log(`Indexing website: ${repo.url}`);

    if (!repo.url) {
      throw new Error('Website URL is required');
    }

    // Discover all pages to crawl
    const urlsToCrawl = await discoverWebsitePages(repo.url);
    console.log(`Discovered ${urlsToCrawl.length} pages to crawl from ${repo.url}`);

    let totalDocumentCount = 0;
    // No artificial limit - we crawl all pages under the documentation root
    const pagesToProcess = urlsToCrawl;

    console.log(`Processing all ${pagesToProcess.length} discovered pages`);

    // Process pages in batches to avoid overwhelming the server
    const batchSize = 3; // Reduced batch size for enhanced processing
    for (let i = 0; i < pagesToProcess.length; i += batchSize) {
      const batch = pagesToProcess.slice(i, i + batchSize);

      const batchPromises = batch.map(async (url, batchIndex) => {
        try {
          console.log(`Crawling page ${i + batchIndex + 1}/${pagesToProcess.length}: ${url}`);

          // Check cache first
          const lastModified = undefined; // Could be enhanced to get from response headers
          const urlHash = ParsedContentCache.generateUrlHash(url, lastModified);
          const cachedContent = await ParsedContentCache.get(urlHash);

          let content: string;
          let html: string;
          let renderingEngine = 'static';
          let requiresDynamicRendering = false;

          if (cachedContent && !(await ParsedContentCache.isContentModified(url, lastModified))) {
            console.log(`Using cached content for ${url}`);
            content = cachedContent.parsedContent;
            html = cachedContent.rawContent;
            renderingEngine = cachedContent.metadata.renderingEngine || 'static';
            requiresDynamicRendering = cachedContent.metadata.requiresDynamicRendering || false;
          } else {
            // Fetch the page content
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'IdeaMem-Documentation-Indexer/1.0',
              },
            });

            if (!response.ok) {
              console.warn(`Failed to fetch ${url}: ${response.status}`);
              return 0;
            }

            html = await response.text();

            // Determine if we need dynamic rendering
            const renderingDecision = await shouldUseDynamicRendering(url, html);
            requiresDynamicRendering = renderingDecision.useDynamic;

            if (requiresDynamicRendering) {
              console.log(
                `Using dynamic rendering for ${url} (confidence: ${renderingDecision.confidence})`
              );
              try {
                const renderResult = await dynamicRenderer.renderPage(url, {
                  timeout: 30000,
                  waitForLoadState: 'networkidle',
                });
                html = renderResult.html;
                renderingEngine = 'playwright-chromium';
                console.log(`Dynamic rendering completed in ${renderResult.renderingTime}ms`);
              } catch (renderError) {
                console.warn(
                  `Dynamic rendering failed for ${url}, falling back to static:`,
                  renderError
                );
                renderingEngine = 'static-fallback';
                requiresDynamicRendering = false;
              }
            }

            content = extractContentFromHTML(html);

            // Cache the processed content
            await ParsedContentCache.set(urlHash, html, content, {
              contentType: 'documentation',
              language: 'en',
              wordCount: content.split(/\s+/).length,
              extractionMethod: 'multi-strategy',
              lastModified,
              renderingEngine,
              requiresDynamicRendering,
            });
          }

          if (!content || content.trim().length < 100) {
            console.warn(`No meaningful content found on ${url}`);
            return 0;
          }

          // Classify content and extract metadata
          const title = extractTitleFromHTML(html);
          const classification = await ContentClassifier.classifyContent(url, content, title);

          // Store enhanced metadata in database
          const docMetadataId = await ContentClassifier.storeClassificationResult(
            prisma,
            url,
            classification
          );

          // Update metadata with rendering information
          await prisma.docMetadata.update({
            where: { id: docMetadataId },
            data: {
              requiresDynamicRendering,
              renderingEngine,
              crawlDuration: 0, // Would be calculated from actual timing
              lastCrawled: new Date(),
            },
          });

          console.log(
            `Content classified as: ${classification.contentType} (confidence: ${classification.confidence})`
          );
          console.log(`Found ${classification.codeExamples.length} code examples`);

          // Generate a meaningful source name from the URL
          const sourceName = generateSourceNameFromUrl(url, repo.url!);

          // Parse the content into chunks - use no language hint to let parser auto-detect
          const result = parserFactory.parse(content, `${sourceName}.txt`);

          let pageDocumentCount = 0;

          // The parser factory always returns chunks, either from a specific parser or fallback
          if (result.chunks.length > 0) {
            // Ingest each chunk with enhanced metadata
            for (const chunk of result.chunks) {
              await ingest({
                content: chunk.content,
                source: `${repo.name}/${sourceName}`,
                type: 'documentation' as const,
                language: classification.language || 'markdown',
                project_id: 'global',
                scope: 'global',
              });

              // Also index for hybrid search
              await HybridSearchEngine.indexContent(chunk.content, url, {
                sourceType: 'website',
                contentType: classification.contentType,
                language: classification.language || 'en',
                title: title,
                complexity: determineComplexity(chunk.content, classification.contentType),
              });

              pageDocumentCount++;
            }

            if (!result.success) {
              console.log(
                `Using fallback parsing for ${sourceName} - got ${result.chunks.length} chunks`
              );
            }
          } else {
            // Fallback to manual chunking only if parser returns no chunks at all
            console.warn(`Parser returned no chunks for ${sourceName}, using manual chunking`);
            const manualChunks = createManualChunks(content);
            for (const chunk of manualChunks) {
              await ingest({
                content: chunk,
                source: `${repo.name}/${sourceName}`,
                type: 'documentation' as const,
                language: classification.language || 'markdown',
                project_id: 'global',
                scope: 'global',
              });

              // Also index for hybrid search
              await HybridSearchEngine.indexContent(chunk, url, {
                sourceType: 'website',
                contentType: classification.contentType,
                language: classification.language || 'en',
                title: title,
                complexity: determineComplexity(chunk, classification.contentType),
              });

              pageDocumentCount++;
            }
          }

          console.log(
            `Indexed ${pageDocumentCount} chunks from ${url} (${classification.contentType})`
          );
          return pageDocumentCount;
        } catch (pageError) {
          console.error(`Error processing page ${url}:`, pageError);
          return 0;
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      const batchTotal = batchResults.reduce((sum, count) => sum + count, 0);
      totalDocumentCount += batchTotal;

      console.log(
        `Completed batch ${Math.floor(i / batchSize) + 1}, indexed ${batchTotal} chunks in this batch`
      );

      // Small delay between batches to be respectful
      if (i + batchSize < pagesToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Increased delay for enhanced processing
      }
    }

    console.log(
      `Successfully indexed website with ${totalDocumentCount} total content chunks from ${pagesToProcess.length} pages`
    );
    return { success: true, documentCount: totalDocumentCount };
  } catch (error) {
    console.error('Error indexing website:', error);
    return {
      success: false,
      documentCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Extract meaningful content from HTML with multiple strategies
function extractContentFromHTML(html: string): string {
  try {
    // Remove script, style, and comment tags
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<!--[\s\S]*?-->/g, '');
    content = content.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Extract title
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const descMatch = content.match(
      /<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i
    );
    const description = descMatch ? descMatch[1].trim() : '';

    // Try multiple strategies to extract meaningful content
    const contentStrategies = [
      // Strategy 1: Look for main content areas
      () => {
        const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/i;
        const match = content.match(mainRegex);
        return match ? match[1] : null;
      },

      // Strategy 2: Look for article content
      () => {
        const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/i;
        const match = content.match(articleRegex);
        return match ? match[1] : null;
      },

      // Strategy 3: Look for content divs (common patterns)
      () => {
        const contentPatterns = [
          /<div[^>]*(?:class|id)=["\'][^"']*(?:content|docs|documentation|article|post|main)[^"']*["\'][^>]*>([\s\S]*?)<\/div>/i,
          /<section[^>]*(?:class|id)=["\'][^"']*(?:content|docs|documentation|article|post|main)[^"']*["\'][^>]*>([\s\S]*?)<\/section>/i,
        ];

        for (const pattern of contentPatterns) {
          const match = content.match(pattern);
          if (match && match[1].trim().length > 200) {
            return match[1];
          }
        }
        return null;
      },

      // Strategy 4: Extract all paragraph content
      () => {
        const paragraphs = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
        if (paragraphs && paragraphs.length > 3) {
          return paragraphs.join('\n');
        }
        return null;
      },

      // Strategy 5: Look for headings and following content
      () => {
        const headingsContent = content.match(
          /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>[\s\S]*?(?=<h[1-6]|$)/gi
        );
        if (headingsContent && headingsContent.length > 0) {
          return headingsContent.slice(0, 10).join('\n'); // Limit to first 10 sections
        }
        return null;
      },

      // Strategy 6: Fallback to body content (filtered)
      () => {
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          // Remove common noise elements
          let bodyContent = bodyMatch[1];
          bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
          bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
          bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
          bodyContent = bodyContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
          return bodyContent;
        }
        return null;
      },
    ];

    let extractedContent = '';

    // Try each strategy until we get meaningful content
    for (const strategy of contentStrategies) {
      const result = strategy();
      if (result && result.trim().length > 100) {
        extractedContent = result;
        console.log(
          `Successfully extracted content using strategy ${contentStrategies.indexOf(strategy) + 1}`
        );
        break;
      }
    }

    if (!extractedContent) {
      extractedContent = content;
      console.log('Using fallback: full HTML content');
    }

    // Clean up HTML tags and normalize whitespace
    extractedContent = extractedContent.replace(/<[^>]+>/g, ' ');
    extractedContent = extractedContent.replace(/&[^;]+;/g, ' '); // Remove HTML entities
    extractedContent = extractedContent.replace(/\s+/g, ' ');
    extractedContent = extractedContent.trim();

    // Remove very short lines that are likely navigation or UI elements
    const lines = extractedContent.split('\n').filter((line) => line.trim().length > 10);
    extractedContent = lines.join('\n');

    // Combine title, description, and content
    const finalContent = [];
    if (title && title.length > 0) finalContent.push(`# ${title}`);
    if (description && description.length > 0) finalContent.push(description);
    if (extractedContent && extractedContent.length > 0) finalContent.push(extractedContent);

    const result = finalContent.join('\n\n').trim();

    // Ensure we have meaningful content
    if (result.length < 100) {
      throw new Error('Extracted content too short, likely failed to parse meaningful content');
    }

    console.log(`Final extracted content length: ${result.length} characters`);
    return result;
  } catch (error) {
    console.error('Error extracting content from HTML:', error);
    // Return basic cleaned HTML as fallback
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Discover all pages to crawl from a website
async function discoverWebsitePages(baseUrl: string): Promise<string[]> {
  const discoveredUrls = new Set<string>();
  const baseUrlObj = new URL(baseUrl);
  const baseDomain = baseUrlObj.hostname;
  const baseUrlPath = baseUrlObj.pathname; // e.g., "/docs" for https://nextjs.org/docs

  // Always include the base URL
  discoveredUrls.add(baseUrl);

  try {
    // Strategy 1: Try to find sitemap.xml
    const sitemapUrls = await tryDiscoverSitemap(baseUrlObj);

    // Separate sitemap URLs into those under our base path vs. others
    const sitemapUrlsUnderBasePath: string[] = [];
    const sitemapUrlsFromOtherPaths: string[] = [];

    for (const url of sitemapUrls) {
      try {
        const urlObj = new URL(url);
        if (urlObj.pathname.startsWith(baseUrlPath)) {
          sitemapUrlsUnderBasePath.push(url);
        } else {
          sitemapUrlsFromOtherPaths.push(url);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    // Add all URLs under our base path (no limits)
    sitemapUrlsUnderBasePath.forEach((url) => discoveredUrls.add(url));

    // Add only limited URLs from other paths (these might be blog, marketing, etc.)
    const maxOtherUrls = 50;
    sitemapUrlsFromOtherPaths.slice(0, maxOtherUrls).forEach((url) => discoveredUrls.add(url));

    console.log(`Found ${sitemapUrlsUnderBasePath.length} URLs under base path from sitemap`);
    console.log(
      `Found ${Math.min(sitemapUrlsFromOtherPaths.length, maxOtherUrls)} URLs from other paths (limited from ${sitemapUrlsFromOtherPaths.length})`
    );

    // Strategy 2: Crawl the main page and all discovered pages under base path for more links
    const pagesToCrawlForLinks = Array.from(discoveredUrls).filter((url) => {
      try {
        return new URL(url).pathname.startsWith(baseUrlPath);
      } catch {
        return false;
      }
    });

    // If we have few URLs under our base path, do comprehensive link crawling
    if (sitemapUrlsUnderBasePath.length < 20) {
      console.log(
        `Only found ${sitemapUrlsUnderBasePath.length} sitemap URLs under base path, doing comprehensive link crawling...`
      );
      const crawledUrls = await comprehensiveLinkCrawling(
        pagesToCrawlForLinks,
        baseDomain,
        baseUrlPath
      );
      crawledUrls.forEach((url) => discoveredUrls.add(url));
      console.log(`Found ${crawledUrls.length} additional URLs from comprehensive link crawling`);
    }

    // Filter and clean URLs
    const filteredUrls = Array.from(discoveredUrls).filter((url) => {
      try {
        const urlObj = new URL(url);
        // Only include URLs from the same domain
        if (urlObj.hostname !== baseDomain) return false;

        // Filter out non-documentation URLs
        const path = urlObj.pathname.toLowerCase();
        const excludePatterns = [
          '/api/',
          '/login',
          '/signup',
          '/auth',
          '/contact',
          '/about',
          '.pdf',
          '.zip',
          '.tar',
          '.gz',
          '.json',
          '.xml',
          '.rss',
          '/images/',
          '/css/',
          '/js/',
          '/fonts/',
          '/static/',
        ];

        if (excludePatterns.some((pattern) => path.includes(pattern))) return false;

        // For URLs under our base path: include ALL of them (no limit)
        if (path.startsWith(baseUrlPath.toLowerCase())) {
          return true;
        }

        // For URLs outside our base path: they were already limited above
        return true;
      } catch {
        return false;
      }
    });

    // Separate URLs by whether they're under our base path for reporting
    const urlsUnderBasePath = filteredUrls.filter((url) => {
      try {
        return new URL(url).pathname.startsWith(baseUrlPath);
      } catch {
        return false;
      }
    });
    const urlsFromOtherPaths = filteredUrls.filter((url) => {
      try {
        return !new URL(url).pathname.startsWith(baseUrlPath);
      } catch {
        return false;
      }
    });

    console.log(
      `Final URL list: ${urlsUnderBasePath.length} pages under base path "${baseUrlPath}" (unlimited), ${urlsFromOtherPaths.length} pages from other paths (limited)`
    );
    console.log(`Total pages to crawl: ${filteredUrls.length}`);

    return filteredUrls;
  } catch (error) {
    console.error('Error discovering website pages:', error);
    return [baseUrl]; // Fallback to just the base URL
  }
}

// Try to discover pages from sitemap.xml
async function tryDiscoverSitemap(baseUrlObj: URL): Promise<string[]> {
  const sitemapUrls = [
    `${baseUrlObj.protocol}//${baseUrlObj.host}/sitemap.xml`,
    `${baseUrlObj.protocol}//${baseUrlObj.host}/sitemap.txt`,
    `${baseUrlObj.protocol}//${baseUrlObj.host}/robots.txt`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`Trying sitemap: ${sitemapUrl}`);
      const response = await fetch(sitemapUrl);
      if (!response.ok) continue;

      const content = await response.text();

      if (sitemapUrl.endsWith('.xml')) {
        // Parse XML sitemap
        const urls = extractUrlsFromXmlSitemap(content);
        if (urls.length > 0) return urls;
      } else if (sitemapUrl.endsWith('.txt')) {
        // Parse text sitemap
        const urls = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('http'));
        if (urls.length > 0) return urls;
      } else if (sitemapUrl.endsWith('robots.txt')) {
        // Look for sitemap references in robots.txt
        const sitemapRefs = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.toLowerCase().startsWith('sitemap:'))
          .map((line) => line.substring(8).trim());

        for (const ref of sitemapRefs) {
          const refUrls = await tryDiscoverSitemap(new URL(ref));
          if (refUrls.length > 0) return refUrls;
        }
      }
    } catch (error) {
      console.log(`Failed to fetch ${sitemapUrl}:`, error);
      continue;
    }
  }

  return [];
}

// Extract URLs from XML sitemap
function extractUrlsFromXmlSitemap(xmlContent: string): string[] {
  const urls: string[] = [];

  // Simple regex-based XML parsing (not perfect but works for most sitemaps)
  const urlMatches = xmlContent.match(/<loc>([^<]+)<\/loc>/g);
  if (urlMatches) {
    for (const match of urlMatches) {
      const url = match.replace(/<\/?loc>/g, '');
      if (url) urls.push(url);
    }
  }

  return urls;
}

// Crawl links from a single page
async function crawlLinksFromPage(url: string, baseDomain: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const html = await response.text();
    const links = extractLinksFromHtml(html, url, baseDomain);

    return Array.from(new Set(links)); // Remove duplicates
  } catch (error) {
    console.error(`Error crawling links from ${url}:`, error);
    return [];
  }
}

// Comprehensive link crawling for documentation sections
async function comprehensiveLinkCrawling(
  seedUrls: string[],
  baseDomain: string,
  baseUrlPath: string
): Promise<string[]> {
  const discoveredLinks = new Set<string>();
  const processedUrls = new Set<string>();
  const toProcess = [...seedUrls];

  console.log(
    `Starting comprehensive link crawling with ${seedUrls.length} seed URLs under path "${baseUrlPath}"`
  );

  // Process in waves to find more documentation pages
  let wave = 0;
  const maxWaves = 3; // Limit depth to prevent infinite crawling
  const maxUrlsPerWave = 50; // Limit URLs processed per wave

  while (toProcess.length > 0 && wave < maxWaves) {
    wave++;
    const currentBatch = toProcess.splice(0, maxUrlsPerWave);
    console.log(`Link crawling wave ${wave}: processing ${currentBatch.length} URLs`);

    const batchPromises = currentBatch.map(async (url) => {
      if (processedUrls.has(url)) return [];
      processedUrls.add(url);

      try {
        const links = await crawlLinksFromPage(url, baseDomain);

        // Filter for links under our base path
        const relevantLinks = links.filter((link) => {
          try {
            const linkUrl = new URL(link);
            return linkUrl.pathname.startsWith(baseUrlPath) && !processedUrls.has(link);
          } catch {
            return false;
          }
        });

        // Add new links to discovery and processing queue
        relevantLinks.forEach((link) => {
          if (!discoveredLinks.has(link) && !processedUrls.has(link)) {
            discoveredLinks.add(link);
            toProcess.push(link);
          }
        });

        return relevantLinks;
      } catch (error) {
        console.error(`Error in comprehensive crawling of ${url}:`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const newLinksFound = batchResults.reduce((sum, links) => sum + links.length, 0);

    console.log(
      `Wave ${wave} completed: found ${newLinksFound} new links, ${toProcess.length} URLs queued for next wave`
    );

    // Small delay between waves
    if (toProcess.length > 0 && wave < maxWaves) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const finalLinks = Array.from(discoveredLinks);
  console.log(
    `Comprehensive link crawling completed after ${wave} waves: discovered ${finalLinks.length} total links`
  );

  return finalLinks;
}

// Extract links from HTML content
function extractLinksFromHtml(html: string, baseUrl: string, baseDomain: string): string[] {
  const links: string[] = [];
  const baseUrlObj = new URL(baseUrl);

  // Find all href attributes
  const hrefMatches = html.match(/href=["\']([^"']+)["\']/g);
  if (hrefMatches) {
    for (const match of hrefMatches) {
      try {
        const href = match.match(/href=["']([^"']+)["']/)?.[1];
        if (!href) continue;

        // Convert relative URLs to absolute
        let absoluteUrl;
        if (href.startsWith('http')) {
          absoluteUrl = href;
        } else if (href.startsWith('/')) {
          absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
        } else if (href.startsWith('./') || !href.includes('/')) {
          absoluteUrl = new URL(href, baseUrl).href;
        } else {
          continue; // Skip complex relative paths
        }

        const linkUrlObj = new URL(absoluteUrl);

        // Only include links from the same domain
        if (linkUrlObj.hostname === baseDomain) {
          links.push(absoluteUrl);
        }
      } catch (_error) {
        // Skip invalid URLs
        continue;
      }
    }
  }

  return links;
}

// Generate meaningful source name from URL
function generateSourceNameFromUrl(url: string, baseUrl: string): string {
  try {
    const urlObj = new URL(url);
    const _baseUrlObj = new URL(baseUrl);

    // Get the path relative to base URL
    let path = urlObj.pathname;
    if (path === '/' || path === '') {
      path = '/index';
    }

    // Remove leading slash and convert to meaningful name
    path = path.replace(/^\//, '');
    path = path.replace(/\/$/, ''); // Remove trailing slash

    // Convert path to readable format
    path = path.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Add hash if present
    if (urlObj.hash) {
      path += urlObj.hash.replace('#', '_section_');
    }

    return path || 'index';
  } catch (_error) {
    return 'content';
  }
}

// Create manual chunks when parser fails - improved chunking strategy
function createManualChunks(content: string): string[] {
  const chunks: string[] = [];
  const minChunkSize = 200;
  const maxChunkSize = 1500;

  // Strategy 1: Split on markdown headers (# ## ### etc.)
  const headerSections = content.split(/(?=^#{1,6}\s)/m);
  if (headerSections.length > 2) {
    const goodSections = headerSections
      .filter((section) => section.trim().length > minChunkSize)
      .map((section) => section.trim());

    if (goodSections.length > 0) {
      // Further split large sections
      const refinedChunks: string[] = [];
      for (const section of goodSections) {
        if (section.length > maxChunkSize) {
          refinedChunks.push(...splitLargeSection(section, maxChunkSize));
        } else {
          refinedChunks.push(section);
        }
      }
      return refinedChunks;
    }
  }

  // Strategy 2: Split on double newlines (paragraph boundaries)
  const paragraphs = content.split('\n\n').filter((p) => p.trim().length > 10);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const cleanParagraph = paragraph.trim();

    // If adding this paragraph would exceed max size, save current chunk
    if (
      currentChunk.length + cleanParagraph.length > maxChunkSize &&
      currentChunk.length > minChunkSize
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = cleanParagraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanParagraph;
    }
  }

  // Add the last chunk
  if (currentChunk.trim().length > minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  // Strategy 3: If we have very few chunks, try sentence-based splitting
  if (chunks.length < 3) {
    return splitBySentences(content, minChunkSize, maxChunkSize);
  }

  return chunks.filter((chunk) => chunk.length >= minChunkSize);
}

// Split large sections into smaller chunks
function splitLargeSection(content: string, maxSize: number): string[] {
  const chunks: string[] = [];

  // Try splitting on sub-headers first
  const subSections = content.split(/(?=^#{2,6}\s)/m);
  if (subSections.length > 1) {
    for (const subSection of subSections) {
      if (subSection.trim().length > 100) {
        if (subSection.length > maxSize) {
          chunks.push(...splitBySentences(subSection, 200, maxSize));
        } else {
          chunks.push(subSection.trim());
        }
      }
    }
    return chunks;
  }

  // Fallback to sentence splitting
  return splitBySentences(content, 200, maxSize);
}

// Split content by sentences with size limits
function splitBySentences(content: string, minSize: number, maxSize: number): string[] {
  const chunks: string[] = [];

  // Split on sentence boundaries (. ! ?) followed by whitespace
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  let currentChunk = '';

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();

    if (currentChunk.length + cleanSentence.length > maxSize && currentChunk.length > minSize) {
      chunks.push(currentChunk.trim());
      currentChunk = cleanSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + cleanSentence;
    }
  }

  if (currentChunk.trim().length > minSize) {
    chunks.push(currentChunk.trim());
  }

  // If we still have very large chunks, split them by words as last resort
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > maxSize * 1.5) {
      finalChunks.push(...splitByWords(chunk, maxSize));
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks.filter((chunk) => chunk.length >= minSize);
}

// Split content by words as last resort
function splitByWords(content: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const words = content.split(/\s+/);
  let currentChunk = '';

  for (const word of words) {
    if (currentChunk.length + word.length > maxSize && currentChunk.length > 100) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + word;
    }
  }

  if (currentChunk.trim().length > 100) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Extract title from HTML
function extractTitleFromHTML(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Fallback to first h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]*>/g, '').trim();
  }

  return undefined;
}

// Determine content complexity based on content and type
function determineComplexity(content: string, contentType: string): string {
  const contentLower = content.toLowerCase();

  // Beginner indicators
  const beginnerIndicators = [
    'getting started',
    'introduction',
    'basic',
    'simple',
    'tutorial',
    'beginner',
    'first steps',
    'quick start',
    'hello world',
  ];

  // Advanced indicators
  const advancedIndicators = [
    'advanced',
    'optimization',
    'performance',
    'architecture',
    'scalability',
    'deep dive',
    'internals',
    'implementation details',
    'best practices',
    'production',
    'enterprise',
    'complex',
  ];

  // Check for beginner content
  for (const indicator of beginnerIndicators) {
    if (contentLower.includes(indicator)) {
      return 'beginner';
    }
  }

  // Check for advanced content
  for (const indicator of advancedIndicators) {
    if (contentLower.includes(indicator)) {
      return 'advanced';
    }
  }

  // Content type-based complexity
  if (contentType === 'tutorial' || contentType === 'example') {
    return 'beginner';
  }

  if (contentType === 'api' && content.length > 2000) {
    return 'advanced';
  }

  // Code complexity indicators
  const codeComplexityIndicators = content.match(
    /\b(async|await|Promise|interface|type|generic|abstract|extends|implements)\b/g
  );
  if (codeComplexityIndicators && codeComplexityIndicators.length > 5) {
    return 'advanced';
  }

  return 'intermediate';
}
