import { NextResponse } from 'next/server';
import { readdir, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';
import * as os from 'os';
import { prisma } from '@/lib/database';

interface DocRepository {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  url: string; // Changed from gitUrl/url to single url field
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

// Auto-detect source type from URL
function detectSourceType(url: string): 'git' | 'llmstxt' | 'website' {
  // Git repository patterns
  if (
    url.includes('github.com') ||
    url.includes('gitlab.com') ||
    url.includes('bitbucket.') ||
    url.endsWith('.git')
  ) {
    return 'git';
  }

  // llms.txt file patterns
  if (url.includes('/llms.txt') || url.includes('/llms-full.txt')) {
    return 'llmstxt';
  }

  // Default to website for other URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return 'website';
  }

  return 'git'; // Fallback
}

// Auto-detect llms.txt URL information
async function autoDetectLLMsTxtInfo(url: string): Promise<{
  name: string;
  description: string;
  languages: string[];
}> {
  try {
    console.log(`Fetching llms.txt from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch llms.txt: ${response.status}`);
    }

    const content = await response.text();

    // Parse llms.txt content
    const lines = content.split('\n');
    let name = 'Unknown Documentation';
    let description = '';
    const languages: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Extract H1 title (# Project Name)
      if (line.startsWith('# ') && !name.includes('/')) {
        name = line.substring(2).trim();
      }

      // Extract blockquote description (> Summary)
      if (line.startsWith('> ')) {
        description = line.substring(2).trim();

        // Continue reading multi-line blockquotes
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith('> ')) {
            description += ' ' + nextLine.substring(2).trim();
            i = j;
          } else {
            break;
          }
        }
      }
    }

    // Detect languages from content and URL
    const contentLower = content.toLowerCase();
    if (
      contentLower.includes('javascript') ||
      contentLower.includes('js') ||
      contentLower.includes('node')
    )
      languages.push('javascript');
    if (contentLower.includes('typescript') || contentLower.includes('ts'))
      languages.push('typescript');
    if (contentLower.includes('python') || contentLower.includes('py')) languages.push('python');
    if (contentLower.includes('react')) languages.push('react');
    if (contentLower.includes('next.js') || contentLower.includes('nextjs'))
      languages.push('nextjs');
    if (contentLower.includes('go') || contentLower.includes('golang')) languages.push('go');
    if (contentLower.includes('rust')) languages.push('rust');
    if (contentLower.includes('api')) languages.push('api');

    return {
      name: name || extractNameFromUrl(url),
      description: description || `Documentation from ${extractNameFromUrl(url)}`,
      languages: languages.slice(0, 5), // Limit to 5 languages
    };
  } catch (error) {
    console.error('Error detecting llms.txt info:', error);

    return {
      name: extractNameFromUrl(url),
      description: `Documentation from ${extractNameFromUrl(url)}`,
      languages: [],
    };
  }
}

// Auto-detect website information
async function autoDetectWebsiteInfo(url: string): Promise<{
  name: string;
  description: string;
  languages: string[];
}> {
  try {
    console.log(`Fetching website info from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : extractNameFromUrl(url);

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i
    );
    const description = descMatch ? descMatch[1].trim() : `Documentation from ${title}`;

    // Basic language detection from content
    const htmlLower = html.toLowerCase();
    const languages: string[] = [];

    if (htmlLower.includes('javascript') || htmlLower.includes('js')) languages.push('javascript');
    if (htmlLower.includes('typescript') || htmlLower.includes('ts')) languages.push('typescript');
    if (htmlLower.includes('python') || htmlLower.includes('api')) languages.push('python');
    if (htmlLower.includes('react')) languages.push('react');
    if (htmlLower.includes('documentation') || htmlLower.includes('docs'))
      languages.push('documentation');

    return {
      name: title,
      description: description,
      languages: languages.slice(0, 5),
    };
  } catch (error) {
    console.error('Error detecting website info:', error);

    return {
      name: extractNameFromUrl(url),
      description: `Documentation from ${extractNameFromUrl(url)}`,
      languages: [],
    };
  }
}

// Extract name from URL
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const pathParts = urlObj.pathname.split('/').filter((p) => p);

    if (pathParts.length > 0) {
      return `${domain}/${pathParts[0]}`;
    }

    return domain;
  } catch (error) {
    return url.split('/')[2] || 'Unknown';
  }
}

// Auto-detect repository information from Git URL and repository contents
async function autoDetectRepositoryInfo(gitUrl: string): Promise<{
  name: string;
  description: string;
  languages: string[];
  branch: string;
}> {
  let tempDir: string | null = null;

  try {
    // Create temporary directory for cloning
    tempDir = path.join(os.tmpdir(), `ideamem-detect-${uuidv4()}`);

    // Extract repository name from URL
    const urlParts = gitUrl.replace(/\.git$/, '').split('/');
    const repoName = urlParts[urlParts.length - 1] || 'Unknown Repository';
    const ownerName = urlParts[urlParts.length - 2] || '';
    const displayName = `${ownerName}/${repoName}`.replace(/^\//, '');

    console.log(`Auto-detecting info for repository: ${displayName}`);

    // Clone repository (shallow clone for speed)
    const git = simpleGit();
    await git.clone(gitUrl, tempDir, ['--depth', '1']);

    // Get default branch
    const repoGit = simpleGit(tempDir);
    const branches = await repoGit.branch(['--all']);
    const defaultBranch = branches.current || 'main';

    // Extract description from README
    const description = await extractDescriptionFromReadme(tempDir);

    // Detect languages
    const languages = await detectLanguages(tempDir);

    return {
      name: displayName,
      description: description || `Documentation for ${repoName}`,
      languages,
      branch: defaultBranch,
    };
  } catch (error) {
    console.error('Error auto-detecting repository info:', error);

    // Fallback to URL-based extraction
    const urlParts = gitUrl.replace(/\.git$/, '').split('/');
    const repoName = urlParts[urlParts.length - 1] || 'Unknown Repository';
    const ownerName = urlParts[urlParts.length - 2] || '';
    const displayName = `${ownerName}/${repoName}`.replace(/^\//, '');

    return {
      name: displayName,
      description: `Documentation for ${repoName}`,
      languages: [],
      branch: 'main',
    };
  } finally {
    // Clean up temporary directory
    if (tempDir && existsSync(tempDir)) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Failed to clean up temp directory ${tempDir}:`, cleanupError);
      }
    }
  }
}

async function extractDescriptionFromReadme(repoPath: string): Promise<string> {
  const readmeFiles = ['README.md', 'readme.md', 'README.rst', 'README.txt'];

  for (const filename of readmeFiles) {
    const filePath = path.join(repoPath, filename);

    if (existsSync(filePath)) {
      try {
        const content = await readFile(filePath, 'utf-8');

        // Extract first paragraph or heading description
        const lines = content.split('\n');
        let description = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Skip empty lines and main title
          if (!line || line.match(/^#{1,3}\s/)) continue;

          // Look for description after title
          if (line && !line.startsWith('#') && !line.startsWith('```')) {
            description = line.replace(/[*_`]/g, '').trim();

            // If description is too short, try to get more context
            if (description.length < 20 && i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('```')) {
                description += ' ' + nextLine.replace(/[*_`]/g, '').trim();
              }
            }

            break;
          }
        }

        // Limit description length
        if (description.length > 200) {
          description = description.substring(0, 200).trim() + '...';
        }

        return description;
      } catch (error) {
        console.warn(`Could not read README file ${filePath}:`, error);
      }
    }
  }

  return '';
}

async function detectLanguages(repoPath: string): Promise<string[]> {
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.scala': 'scala',
    '.clj': 'clojure',
    '.hs': 'haskell',
    '.elm': 'elm',
    '.dart': 'dart',
    '.lua': 'lua',
    '.r': 'r',
    '.m': 'objective-c',
    '.mm': 'objective-c',
  };

  const languageCount: Record<string, number> = {};

  try {
    await scanDirectory(repoPath, languageMap, languageCount, 0, 3); // Max depth 3

    // Also check for common framework/config files
    const configFiles = [
      { file: 'package.json', languages: ['javascript', 'typescript'] },
      { file: 'Cargo.toml', languages: ['rust'] },
      { file: 'go.mod', languages: ['go'] },
      { file: 'requirements.txt', languages: ['python'] },
      { file: 'Pipfile', languages: ['python'] },
      { file: 'poetry.lock', languages: ['python'] },
      { file: 'Gemfile', languages: ['ruby'] },
      { file: 'composer.json', languages: ['php'] },
      { file: 'pom.xml', languages: ['java'] },
      { file: 'build.gradle', languages: ['java'] },
      { file: 'pubspec.yaml', languages: ['dart'] },
    ];

    for (const config of configFiles) {
      if (existsSync(path.join(repoPath, config.file))) {
        config.languages.forEach((lang) => {
          languageCount[lang] = (languageCount[lang] || 0) + 10; // Boost for config files
        });
      }
    }

    // Return languages sorted by frequency
    return Object.entries(languageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5 languages
      .map(([lang]) => lang);
  } catch (error) {
    console.warn('Error detecting languages:', error);
    return [];
  }
}

async function scanDirectory(
  dirPath: string,
  languageMap: Record<string, string>,
  languageCount: Record<string, number>,
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth >= maxDepth) return;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip common directories we don't want to scan
      if (entry.isDirectory()) {
        if (
          [
            'node_modules',
            '.git',
            '.next',
            'dist',
            'build',
            'target',
            '__pycache__',
            '.vscode',
            '.idea',
          ].includes(entry.name)
        ) {
          continue;
        }
        await scanDirectory(fullPath, languageMap, languageCount, currentDepth + 1, maxDepth);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const language = languageMap[ext];

        if (language) {
          languageCount[language] = (languageCount[language] || 0) + 1;
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

async function loadRepositories(): Promise<DocRepository[]> {
  try {
    const repositories = await prisma.documentationRepository.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // Transform Prisma data to interface format
    return repositories.map(repo => ({
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
    }));
  } catch (error) {
    console.error('Error loading repositories:', error);
    return [];
  }
}

// GET - Fetch all documentation repositories
export async function GET() {
  try {
    const repositories = await loadRepositories();
    return NextResponse.json({
      success: true,
      repositories,
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

// POST - Add new documentation source (Git, llms.txt, or website) and auto-start indexing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body; // Changed from gitUrl to url for flexibility

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    // Check for duplicate URLs in database
    const existingRepo = await prisma.documentationRepository.findFirst({
      where: { url }
    });

    if (existingRepo) {
      return NextResponse.json(
        { success: false, error: 'Source with this URL already exists' },
        { status: 400 }
      );
    }

    // Auto-detect source type
    const sourceType = detectSourceType(url);
    console.log(`Detected source type: ${sourceType} for URL: ${url}`);

    // Fast repository creation with basic info from URL
    let name: string;
    if (sourceType === 'git') {
      const urlParts = url.replace(/\.git$/, '').split('/');
      const repoName = urlParts[urlParts.length - 1] || 'Unknown Repository';
      const ownerName = urlParts[urlParts.length - 2] || '';
      name = `${ownerName}/${repoName}`.replace(/^\//, '');
    } else {
      name = extractNameFromUrl(url);
    }

    const newRepo = await prisma.documentationRepository.create({
      data: {
        id: uuidv4(),
        name,
        sourceType,
        url,
        branch: sourceType === 'git' ? 'main' : 'main',
        description: `Documentation from ${name}`, // Will be updated during indexing
        language: null, // Will be detected during indexing
        isActive: true,
        totalDocuments: 0,
        lastIndexingStatus: 'INDEXING', // Start indexing immediately
        lastIndexingError: null,
        lastIndexedAt: null,
        autoReindexEnabled: true,
        reindexInterval: 14
      }
    });

    console.log(
      `${sourceType.toUpperCase()} source ${name} added, starting background indexing...`
    );

    // Start background indexing immediately (non-blocking)
    startBackgroundIndexing(newRepo.id, url, sourceType).catch((error) => {
      console.error(`Background indexing failed for ${name}:`, error);
    });

    // Transform to interface format for response
    const responseRepo: DocRepository = {
      id: newRepo.id,
      name: newRepo.name,
      sourceType: newRepo.sourceType as 'git' | 'llmstxt' | 'website',
      url: newRepo.url,
      branch: newRepo.branch,
      description: newRepo.description || undefined,
      languages: [],
      lastIndexed: undefined,
      status: 'indexing',
      documentCount: 0,
      lastError: undefined,
      createdAt: newRepo.createdAt.toISOString(),
      updatedAt: newRepo.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      message: `${sourceType.toUpperCase()} source ${name} added and indexing started`,
      repository: responseRepo,
    });
  } catch (error) {
    console.error('Error adding repository:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add repository' },
      { status: 500 }
    );
  }
}

// Background indexing function that runs without blocking the response
async function startBackgroundIndexing(
  repositoryId: string,
  url: string,
  sourceType: 'git' | 'llmstxt' | 'website'
) {
  try {
    console.log(`Starting background auto-detection and indexing for ${sourceType}...`);

    let detectedInfo;

    // Auto-detect information based on source type
    switch (sourceType) {
      case 'git':
        detectedInfo = await autoDetectRepositoryInfo(url);
        break;
      case 'llmstxt':
        detectedInfo = await autoDetectLLMsTxtInfo(url);
        break;
      case 'website':
        detectedInfo = await autoDetectWebsiteInfo(url);
        break;
      default:
        throw new Error(`Unknown source type: ${sourceType}`);
    }

    // Update repository with detected info
    await updateRepositoryWithDetectedInfo(repositoryId, detectedInfo);

    // Start the actual indexing process
    const indexResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/global/docs/index`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId }),
      }
    );

    if (!indexResponse.ok) {
      const error = await indexResponse.json();
      throw new Error(error.error || 'Failed to start indexing');
    }

    console.log(
      `Background indexing started successfully for ${sourceType} source ${repositoryId}`
    );
  } catch (error) {
    console.error(`Background indexing failed for ${sourceType} source ${repositoryId}:`, error);

    // Update repository status to error
    await updateRepositoryStatus(
      repositoryId,
      'error',
      0,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Helper function to update repository status
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

// Helper function to update repository with detected information
async function updateRepositoryWithDetectedInfo(
  repositoryId: string,
  repoInfo: { name: string; description: string; languages: string[]; branch?: string }
) {
  try {
    await prisma.documentationRepository.update({
      where: { id: repositoryId },
      data: {
        name: repoInfo.name,
        description: repoInfo.description,
        language: repoInfo.languages.length > 0 ? repoInfo.languages[0] : null,
        branch: repoInfo.branch || undefined,
        updatedAt: new Date()
      }
    });
    console.log(`Updated repository ${repositoryId} with detected info: ${repoInfo.name}`);
  } catch (error) {
    console.error(`Failed to update repository ${repositoryId}:`, error);
  }
}

// PUT - Update existing documentation repository
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, url, branch, description, languages } = body;

    if (!id || !name || !url) {
      return NextResponse.json(
        { success: false, error: 'ID, name, and URL are required' },
        { status: 400 }
      );
    }

    // Check if repository exists
    const existingRepo = await prisma.documentationRepository.findUnique({
      where: { id }
    });

    if (!existingRepo) {
      return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
    }

    // Check for duplicate names or URLs (excluding current repo)
    const duplicateRepo = await prisma.documentationRepository.findFirst({
      where: {
        id: { not: id },
        OR: [
          { name },
          { url }
        ]
      }
    });

    if (duplicateRepo) {
      return NextResponse.json(
        { success: false, error: 'Repository with this name or URL already exists' },
        { status: 400 }
      );
    }

    // Update repository
    const updatedRepo = await prisma.documentationRepository.update({
      where: { id },
      data: {
        name,
        url,
        branch: branch || existingRepo.branch,
        description: description || existingRepo.description,
        language: Array.isArray(languages) && languages.length > 0 ? languages[0] : existingRepo.language,
        updatedAt: new Date()
      }
    });

    // Transform to interface format
    const responseRepo: DocRepository = {
      id: updatedRepo.id,
      name: updatedRepo.name,
      sourceType: updatedRepo.sourceType as 'git' | 'llmstxt' | 'website',
      url: updatedRepo.url,
      branch: updatedRepo.branch,
      description: updatedRepo.description || undefined,
      languages: updatedRepo.language ? [updatedRepo.language] : [],
      lastIndexed: updatedRepo.lastIndexedAt?.toISOString(),
      status: (updatedRepo.lastIndexingStatus?.toLowerCase() || 'pending') as 'pending' | 'indexing' | 'completed' | 'error',
      documentCount: updatedRepo.totalDocuments,
      lastError: updatedRepo.lastIndexingError || undefined,
      createdAt: updatedRepo.createdAt.toISOString(),
      updatedAt: updatedRepo.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Repository updated successfully',
      repository: responseRepo,
    });
  } catch (error) {
    console.error('Error updating repository:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update repository' },
      { status: 500 }
    );
  }
}

// DELETE - Remove documentation repository
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Check if repository exists
    const existingRepo = await prisma.documentationRepository.findUnique({
      where: { id }
    });

    if (!existingRepo) {
      return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
    }

    // Delete repository from database
    const deletedRepo = await prisma.documentationRepository.delete({
      where: { id }
    });

    // Transform to interface format
    const responseRepo: DocRepository = {
      id: deletedRepo.id,
      name: deletedRepo.name,
      sourceType: deletedRepo.sourceType as 'git' | 'llmstxt' | 'website',
      url: deletedRepo.url,
      branch: deletedRepo.branch,
      description: deletedRepo.description || undefined,
      languages: deletedRepo.language ? [deletedRepo.language] : [],
      lastIndexed: deletedRepo.lastIndexedAt?.toISOString(),
      status: (deletedRepo.lastIndexingStatus?.toLowerCase() || 'pending') as 'pending' | 'indexing' | 'completed' | 'error',
      documentCount: deletedRepo.totalDocuments,
      lastError: deletedRepo.lastIndexingError || undefined,
      createdAt: deletedRepo.createdAt.toISOString(),
      updatedAt: deletedRepo.updatedAt.toISOString()
    };

    // TODO: Also clean up any indexed documentation from the vector store
    // This would involve calling deleteSource with the repository's documentation

    return NextResponse.json({
      success: true,
      message: 'Repository deleted successfully',
      repository: responseRepo,
    });
  } catch (error) {
    console.error('Error deleting repository:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete repository' },
      { status: 500 }
    );
  }
}
