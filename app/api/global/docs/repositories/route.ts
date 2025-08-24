import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir, readdir, stat, rm } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit from 'simple-git';
import * as os from 'os';

interface DocRepository {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  gitUrl?: string;
  url?: string; // For llms.txt or website URLs
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

const DATA_DIR = path.join(process.cwd(), 'data');
const REPOS_FILE = path.join(DATA_DIR, 'doc-repositories.json');

// Auto-detect source type from URL
function detectSourceType(url: string): 'git' | 'llmstxt' | 'website' {
  // Git repository patterns
  if (url.includes('github.com') || url.includes('gitlab.com') || url.includes('bitbucket.') || url.endsWith('.git')) {
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
    let languages: string[] = [];
    
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
    if (contentLower.includes('javascript') || contentLower.includes('js') || contentLower.includes('node')) languages.push('javascript');
    if (contentLower.includes('typescript') || contentLower.includes('ts')) languages.push('typescript');
    if (contentLower.includes('python') || contentLower.includes('py')) languages.push('python');
    if (contentLower.includes('react')) languages.push('react');
    if (contentLower.includes('next.js') || contentLower.includes('nextjs')) languages.push('nextjs');
    if (contentLower.includes('go') || contentLower.includes('golang')) languages.push('go');
    if (contentLower.includes('rust')) languages.push('rust');
    if (contentLower.includes('api')) languages.push('api');
    
    return {
      name: name || extractNameFromUrl(url),
      description: description || `Documentation from ${extractNameFromUrl(url)}`,
      languages: languages.slice(0, 5) // Limit to 5 languages
    };
  } catch (error) {
    console.error('Error detecting llms.txt info:', error);
    
    return {
      name: extractNameFromUrl(url),
      description: `Documentation from ${extractNameFromUrl(url)}`,
      languages: []
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
    const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : `Documentation from ${title}`;
    
    // Basic language detection from content
    const htmlLower = html.toLowerCase();
    const languages: string[] = [];
    
    if (htmlLower.includes('javascript') || htmlLower.includes('js')) languages.push('javascript');
    if (htmlLower.includes('typescript') || htmlLower.includes('ts')) languages.push('typescript');
    if (htmlLower.includes('python') || htmlLower.includes('api')) languages.push('python');
    if (htmlLower.includes('react')) languages.push('react');
    if (htmlLower.includes('documentation') || htmlLower.includes('docs')) languages.push('documentation');
    
    return {
      name: title,
      description: description,
      languages: languages.slice(0, 5)
    };
  } catch (error) {
    console.error('Error detecting website info:', error);
    
    return {
      name: extractNameFromUrl(url),
      description: `Documentation from ${extractNameFromUrl(url)}`,
      languages: []
    };
  }
}

// Extract name from URL
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    
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
      branch: defaultBranch
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
      branch: 'main'
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
    '.mm': 'objective-c'
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
      { file: 'pubspec.yaml', languages: ['dart'] }
    ];
    
    for (const config of configFiles) {
      if (existsSync(path.join(repoPath, config.file))) {
        config.languages.forEach(lang => {
          languageCount[lang] = (languageCount[lang] || 0) + 10; // Boost for config files
        });
      }
    }
    
    // Return languages sorted by frequency
    return Object.entries(languageCount)
      .sort(([,a], [,b]) => b - a)
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
        if (['node_modules', '.git', '.next', 'dist', 'build', 'target', '__pycache__', '.vscode', '.idea'].includes(entry.name)) {
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

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadRepositories(): Promise<DocRepository[]> {
  try {
    await ensureDataDir();
    if (!existsSync(REPOS_FILE)) {
      return [];
    }
    const data = await readFile(REPOS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading repositories:', error);
    return [];
  }
}

async function saveRepositories(repositories: DocRepository[]): Promise<void> {
  try {
    await ensureDataDir();
    await writeFile(REPOS_FILE, JSON.stringify(repositories, null, 2));
  } catch (error) {
    console.error('Error saving repositories:', error);
    throw new Error('Failed to save repositories');
  }
}

// GET - Fetch all documentation repositories
export async function GET() {
  try {
    const repositories = await loadRepositories();
    return NextResponse.json({
      success: true,
      repositories
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
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const repositories = await loadRepositories();
    
    // Check for duplicate URLs (check both gitUrl and url fields)
    const existingRepo = repositories.find(repo => 
      repo.gitUrl === url || repo.url === url
    );
    
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
    
    const newRepo: DocRepository = {
      id: uuidv4(),
      name,
      sourceType,
      ...(sourceType === 'git' ? { gitUrl: url, branch: 'main' } : { url }),
      description: `Documentation from ${name}`, // Will be updated during indexing
      languages: [], // Will be detected during indexing
      status: 'indexing', // Start indexing immediately
      documentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    repositories.push(newRepo);
    await saveRepositories(repositories);

    console.log(`${sourceType.toUpperCase()} source ${name} added, starting background indexing...`);

    // Start background indexing immediately (non-blocking)
    startBackgroundIndexing(newRepo.id, url, sourceType).catch(error => {
      console.error(`Background indexing failed for ${name}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: `${sourceType.toUpperCase()} source ${name} added and indexing started`,
      repository: newRepo
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
async function startBackgroundIndexing(repositoryId: string, url: string, sourceType: 'git' | 'llmstxt' | 'website') {
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
    const indexResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/global/docs/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositoryId })
    });
    
    if (!indexResponse.ok) {
      const error = await indexResponse.json();
      throw new Error(error.error || 'Failed to start indexing');
    }
    
    console.log(`Background indexing started successfully for ${sourceType} source ${repositoryId}`);
  } catch (error) {
    console.error(`Background indexing failed for ${sourceType} source ${repositoryId}:`, error);
    
    // Update repository status to error
    await updateRepositoryStatus(repositoryId, 'error', 0, error instanceof Error ? error.message : 'Unknown error');
  }
}

// Helper function to update repository status
async function updateRepositoryStatus(
  id: string, 
  status: DocRepository['status'], 
  documentCount?: number, 
  error?: string
) {
  const repositories = await loadRepositories();
  const repoIndex = repositories.findIndex(repo => repo.id === id);
  
  if (repoIndex !== -1) {
    repositories[repoIndex] = {
      ...repositories[repoIndex],
      status,
      documentCount: documentCount ?? repositories[repoIndex].documentCount,
      lastError: error,
      lastIndexed: status === 'completed' ? new Date().toISOString() : repositories[repoIndex].lastIndexed,
      updatedAt: new Date().toISOString()
    };
    await saveRepositories(repositories);
  }
}

// Helper function to update repository with detected information
async function updateRepositoryWithDetectedInfo(
  repositoryId: string, 
  repoInfo: { name: string; description: string; languages: string[]; branch?: string }
) {
  const repositories = await loadRepositories();
  const repoIndex = repositories.findIndex(repo => repo.id === repositoryId);
  
  if (repoIndex !== -1) {
    repositories[repoIndex] = {
      ...repositories[repoIndex],
      name: repoInfo.name,
      description: repoInfo.description,
      languages: repoInfo.languages,
      ...(repoInfo.branch && { branch: repoInfo.branch }),
      updatedAt: new Date().toISOString()
    };
    await saveRepositories(repositories);
    console.log(`Updated repository ${repositoryId} with detected info: ${repoInfo.name}`);
  }
}

// PUT - Update existing documentation repository
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, gitUrl, branch, description, languages } = body;

    if (!id || !name || !gitUrl) {
      return NextResponse.json(
        { success: false, error: 'ID, name, and Git URL are required' },
        { status: 400 }
      );
    }

    const repositories = await loadRepositories();
    const repoIndex = repositories.findIndex(repo => repo.id === id);
    
    if (repoIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Repository not found' },
        { status: 404 }
      );
    }

    // Check for duplicate names or URLs (excluding current repo)
    const existingRepo = repositories.find(repo => 
      repo.id !== id && (repo.name === name || repo.gitUrl === gitUrl)
    );
    
    if (existingRepo) {
      return NextResponse.json(
        { success: false, error: 'Repository with this name or URL already exists' },
        { status: 400 }
      );
    }

    // Update repository
    repositories[repoIndex] = {
      ...repositories[repoIndex],
      name,
      gitUrl,
      branch: branch || repositories[repoIndex].branch,
      description: description || repositories[repoIndex].description,
      languages: Array.isArray(languages) ? languages : repositories[repoIndex].languages,
      updatedAt: new Date().toISOString()
    };

    await saveRepositories(repositories);

    return NextResponse.json({
      success: true,
      message: 'Repository updated successfully',
      repository: repositories[repoIndex]
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

    const repositories = await loadRepositories();
    const repoIndex = repositories.findIndex(repo => repo.id === id);
    
    if (repoIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Repository not found' },
        { status: 404 }
      );
    }

    const removedRepo = repositories.splice(repoIndex, 1)[0];
    await saveRepositories(repositories);

    // TODO: Also clean up any indexed documentation from the vector store
    // This would involve calling deleteSource with the repository's documentation

    return NextResponse.json({
      success: true,
      message: 'Repository deleted successfully',
      repository: removedRepo
    });
  } catch (error) {
    console.error('Error deleting repository:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete repository' },
      { status: 500 }
    );
  }
}