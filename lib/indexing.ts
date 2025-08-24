import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ingest } from './memory';
import { updateIndexingProgress, IndexingJob } from './projects';

const execAsync = promisify(exec);

// File extensions we want to index
const INDEXABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.cs', '.vb',
  '.sql', '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css',
  '.scss', '.sass', '.less', '.vue', '.svelte', '.dart', '.lua', '.pl',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.r', '.m',
  '.dockerfile', '.makefile', '.cmake', '.toml', '.ini', '.cfg', '.conf'
]);

// Files and directories to skip
const SKIP_PATTERNS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'target',
  '.next', '.nuxt', '.vscode', '.idea', '__pycache__', '.pytest_cache',
  'coverage', '.coverage', '.nyc_output', 'logs', '*.log', 'tmp', 'temp',
  '.DS_Store', 'Thumbs.db', '.env', '.env.local', '.env.production'
]);

interface IndexingContext {
  projectId: string;
  repoPath: string;
  cancelled: boolean;
  totalFiles: number;
  processedFiles: number;
}

const runningJobs = new Map<string, IndexingContext>();

export async function startCodebaseIndexing(projectId: string, gitRepo: string): Promise<void> {
  if (runningJobs.has(projectId)) {
    throw new Error('Indexing already in progress for this project');
  }

  const tempDir = path.join(process.cwd(), 'tmp', 'repos', projectId);
  const context: IndexingContext = {
    projectId,
    repoPath: tempDir,
    cancelled: false,
    totalFiles: 0,
    processedFiles: 0
  };

  runningJobs.set(projectId, context);

  try {
    // Start the indexing process
    await performIndexing(context, gitRepo);
  } catch (error) {
    console.error('Indexing failed:', error);
    await updateIndexingProgress(projectId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    runningJobs.delete(projectId);
    // Cleanup temp directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  }
}

export function cancelIndexing(projectId: string): boolean {
  const context = runningJobs.get(projectId);
  if (!context) return false;

  context.cancelled = true;
  return true;
}

export function getIndexingStatus(projectId: string): IndexingJob | null {
  const context = runningJobs.get(projectId);
  if (!context) return null;

  return {
    projectId,
    status: 'running',
    progress: context.totalFiles > 0 ? Math.round((context.processedFiles / context.totalFiles) * 100) : 0,
    totalFiles: context.totalFiles,
    processedFiles: context.processedFiles,
    startTime: new Date().toISOString() // This should be stored properly
  };
}

async function performIndexing(context: IndexingContext, gitRepo: string): Promise<void> {
  // Step 1: Clone repository
  await updateIndexingProgress(context.projectId, {
    progress: 5,
    status: 'running'
  });

  await cloneRepository(gitRepo, context.repoPath);

  if (context.cancelled) {
    await updateIndexingProgress(context.projectId, { status: 'cancelled' });
    return;
  }

  // Step 2: Scan files
  await updateIndexingProgress(context.projectId, {
    progress: 10,
    currentFile: 'Scanning files...'
  });

  const files = await scanFiles(context.repoPath);
  context.totalFiles = files.length;

  await updateIndexingProgress(context.projectId, {
    progress: 15,
    totalFiles: files.length,
    processedFiles: 0
  });

  if (context.cancelled) {
    await updateIndexingProgress(context.projectId, { status: 'cancelled' });
    return;
  }

  // Step 3: Process files
  let vectorCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    if (context.cancelled) {
      await updateIndexingProgress(context.projectId, { status: 'cancelled' });
      return;
    }

    const file = files[i];
    const relativePath = path.relative(context.repoPath, file);
    
    await updateIndexingProgress(context.projectId, {
      currentFile: relativePath,
      processedFiles: i,
      progress: 15 + Math.round((i / files.length) * 80)
    });

    try {
      const result = await processFile(context.projectId, file, relativePath);
      vectorCount += result.vectors_added;
      context.processedFiles = i + 1;
    } catch (error) {
      console.warn(`Failed to process file ${relativePath}:`, error);
      // Continue with other files
    }
  }

  // Step 4: Complete
  await updateIndexingProgress(context.projectId, {
    progress: 100,
    status: 'completed',
    processedFiles: files.length,
    vectorCount: vectorCount
  });

  console.log(`Indexing completed: ${files.length} files, ${vectorCount} vectors`);
}

async function cloneRepository(gitRepo: string, targetPath: string): Promise<void> {
  // Ensure parent directory exists
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // Remove existing directory if it exists
  try {
    await fs.rmdir(targetPath, { recursive: true });
  } catch {
    // Directory doesn't exist, that's fine
  }

  // Clone repository with depth 1 for faster cloning
  const command = `git clone --depth 1 "${gitRepo}" "${targetPath}"`;
  
  try {
    await execAsync(command, { timeout: 300000 }); // 5 minute timeout
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error}`);
  }
}

async function scanFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];

  async function scanDirectory(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip patterns
      if (shouldSkip(entry.name, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && shouldIndex(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await scanDirectory(repoPath);
  return files;
}

function shouldSkip(name: string, fullPath: string): boolean {
  // Check against skip patterns
  const patterns = Array.from(SKIP_PATTERNS);
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Simple glob pattern
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(name) || regex.test(path.basename(fullPath))) {
        return true;
      }
    } else if (name === pattern || path.basename(fullPath) === pattern) {
      return true;
    }
  }

  // Skip hidden files and directories (except .env files which are in skip list)
  if (name.startsWith('.') && name !== '.env') {
    return true;
  }

  return false;
}

function shouldIndex(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
}

async function processFile(projectId: string, filePath: string, relativePath: string): Promise<{ vectors_added: number }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Skip very large files (> 1MB)
    if (content.length > 1024 * 1024) {
      console.warn(`Skipping large file: ${relativePath}`);
      return { vectors_added: 0 };
    }

    // Skip empty files
    if (content.trim().length === 0) {
      return { vectors_added: 0 };
    }

    // Determine language from file extension
    const language = getLanguageFromExtension(path.extname(filePath));
    const type = getContentType(language);

    // Ingest the file
    const result = await ingest({
      content,
      source: relativePath,
      type,
      language,
      project_id: projectId,
      scope: 'project'
    });

    return { vectors_added: result.vectors_added };
  } catch (error) {
    console.error(`Error processing file ${relativePath}:`, error);
    return { vectors_added: 0 };
  }
}

function getLanguageFromExtension(ext: string): string {
  const extensionMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.cs': 'csharp',
    '.vb': 'vb',
    '.sql': 'sql',
    '.md': 'markdown',
    '.txt': 'text',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.dart': 'dart',
    '.lua': 'lua',
    '.pl': 'perl',
    '.sh': 'bash',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.fish': 'fish',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.cmd': 'batch',
    '.r': 'r',
    '.m': 'matlab',
    '.dockerfile': 'dockerfile',
    '.makefile': 'makefile',
    '.cmake': 'cmake',
    '.toml': 'toml',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.conf': 'conf'
  };

  return extensionMap[ext.toLowerCase()] || 'text';
}

function getContentType(language: string): 'code' | 'documentation' | 'conversation' | 'user_preference' | 'rule' {
  const documentationLanguages = new Set(['markdown', 'text', 'html']);
  const configLanguages = new Set(['json', 'yaml', 'xml', 'toml', 'ini', 'conf']);

  if (documentationLanguages.has(language)) {
    return 'documentation';
  } else if (configLanguages.has(language)) {
    return 'user_preference';
  } else {
    return 'code';
  }
}