import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ingest } from './memory';
import {
  updateIndexingProgress,
  IndexingJob,
  updateProject,
  getProject,
  startIndexingJob,
} from './projects';
import { deleteSource, listProjects, deleteAllProjectVectors } from './memory';

const execAsync = promisify(exec);

// File extensions we want to index
const INDEXABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.go',
  '.rs',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.scala',
  '.cs',
  '.vb',
  '.sql',
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.dart',
  '.lua',
  '.pl',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.ps1',
  '.bat',
  '.cmd',
  '.r',
  '.m',
  '.dockerfile',
  '.makefile',
  '.cmake',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
]);

// Files and directories to skip
const SKIP_PATTERNS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'target',
  '.next',
  '.nuxt',
  '.vscode',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  'coverage',
  '.coverage',
  '.nyc_output',
  'logs',
  '*.log',
  'tmp',
  'temp',
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
]);

interface IndexingContext {
  projectId: string;
  jobId: string;
  repoPath: string;
  cancelled: boolean;
  totalFiles: number;
  processedFiles: number;
}

interface GitDiffResult {
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  renamedFiles: Array<{ from: string; to: string }>;
}

const runningJobs = new Map<string, IndexingContext>();

export async function startIncrementalIndexing(
  projectId: string,
  gitRepo: string,
  targetCommit: string,
  targetBranch: string = 'main'
): Promise<void> {
  if (runningJobs.has(projectId)) {
    throw new Error('Indexing already in progress for this project');
  }

  // Create indexing job in database
  const job = await startIndexingJob(projectId, {
    branch: targetBranch,
    fullReindex: false,
    triggeredBy: 'WEBHOOK',
  });

  const tempDir = path.join(process.cwd(), 'tmp', 'repos', projectId);
  const context: IndexingContext = {
    projectId,
    jobId: job.id,
    repoPath: tempDir,
    cancelled: false,
    totalFiles: 0,
    processedFiles: 0,
  };

  runningJobs.set(projectId, context);

  try {
    await performIncrementalIndexing(context, gitRepo, targetCommit, targetBranch);
  } catch (error) {
    console.error('Incremental indexing failed:', error);
    await updateIndexingProgress(context.jobId, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    runningJobs.delete(projectId);
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  }
}

export async function startCodebaseIndexing(projectId: string, gitRepo: string): Promise<void> {
  if (runningJobs.has(projectId)) {
    throw new Error('Indexing already in progress for this project');
  }

  // Create indexing job in database
  const job = await startIndexingJob(projectId, {
    branch: 'main',
    fullReindex: true,
    triggeredBy: 'MANUAL',
  });

  const tempDir = path.join(process.cwd(), 'tmp', 'repos', projectId);
  const context: IndexingContext = {
    projectId,
    jobId: job.id,
    repoPath: tempDir,
    cancelled: false,
    totalFiles: 0,
    processedFiles: 0,
  };

  runningJobs.set(projectId, context);

  try {
    // Start the indexing process
    await performIndexing(context, gitRepo);
  } catch (error) {
    console.error('Indexing failed:', error);
    await updateIndexingProgress(context.jobId, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    runningJobs.delete(projectId);
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
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

export function getIndexingStatus(projectId: string): any | null {
  const context = runningJobs.get(projectId);
  if (!context) return null;

  return {
    projectId,
    status: 'RUNNING',
    progress:
      context.totalFiles > 0 ? Math.round((context.processedFiles / context.totalFiles) * 100) : 0,
    totalFiles: context.totalFiles,
    processedFiles: context.processedFiles,
  };
}

async function performIndexing(context: IndexingContext, gitRepo: string): Promise<void> {
  // Step 1: Clone repository
  await updateIndexingProgress(context.jobId, {
    progress: 5,
    status: 'RUNNING',
  });

  await cloneRepository(gitRepo, context.repoPath);

  if (context.cancelled) {
    await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
    return;
  }

  // Step 2: Scan files
  await updateIndexingProgress(context.jobId, {
    progress: 10,
    currentFile: 'Scanning files...',
  });

  const files = await scanFiles(context.repoPath);
  context.totalFiles = files.length;

  await updateIndexingProgress(context.jobId, {
    progress: 15,
    totalFiles: files.length,
    processedFiles: 0,
  });

  if (context.cancelled) {
    await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
    return;
  }

  // Step 3: Process files
  let vectorCount = 0;

  for (let i = 0; i < files.length; i++) {
    if (context.cancelled) {
      await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
      return;
    }

    const file = files[i];
    const relativePath = path.relative(context.repoPath, file);

    await updateIndexingProgress(context.jobId, {
      currentFile: relativePath,
      processedFiles: i,
      progress: 15 + Math.round((i / files.length) * 80),
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

  // Step 4: Get current commit hash and complete
  const currentCommit = await getCurrentCommitHash(context.repoPath);
  const currentBranch = await getCurrentBranch(context.repoPath);

  await updateIndexingProgress(context.jobId, {
    progress: 100,
    status: 'COMPLETED',
    processedFiles: files.length,
    vectorsAdded: vectorCount,
  });

  // Update project with commit tracking and statistics
  await updateProject(context.projectId, {
    lastIndexedCommit: currentCommit,
    lastIndexedBranch: currentBranch,
    fileCount: files.length,
    vectorCount: vectorCount,
    indexedAt: new Date(),
  });

  // Mark indexing job as completed
  await updateIndexingProgress(context.jobId, {
    status: 'COMPLETED',
    progress: 100,
    processedFiles: files.length,
    vectorsAdded: vectorCount,
  });

  console.log(
    `Indexing completed: ${files.length} files, ${vectorCount} vectors, commit: ${currentCommit}`
  );
}

async function cloneRepository(gitRepo: string, targetPath: string): Promise<void> {
  // Ensure parent directory exists
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  // Remove existing directory if it exists
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
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

async function processFile(
  projectId: string,
  filePath: string,
  relativePath: string
): Promise<{ vectors_added: number }> {
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
      scope: 'project',
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
    '.conf': 'conf',
  };

  return extensionMap[ext.toLowerCase()] || 'text';
}

function getContentType(
  language: string
): 'code' | 'documentation' | 'conversation' | 'user_preference' | 'rule' {
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

// Incremental indexing implementation
async function performIncrementalIndexing(
  context: IndexingContext,
  gitRepo: string,
  targetCommit: string,
  targetBranch: string
): Promise<void> {
  // Step 1: Setup repository
  await updateIndexingProgress(context.jobId, {
    progress: 5,
    status: 'RUNNING',
    currentFile: 'Setting up repository...',
  });

  await setupRepositoryForIncremental(gitRepo, context.repoPath, targetBranch);

  if (context.cancelled) {
    await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
    return;
  }

  // Step 2: Get project info to find last indexed commit
  const project = await getProject(context.projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  let filesToProcess: string[] = [];
  let vectorCount = 0;

  if (!project.lastIndexedCommit) {
    // First time indexing - do full index
    console.log('First time indexing - processing all files');
    await updateIndexingProgress(context.jobId, {
      progress: 10,
      currentFile: 'First time indexing - scanning all files...',
    });
    filesToProcess = await scanFiles(context.repoPath);
  } else {
    // Incremental indexing - get diff
    console.log(`Incremental indexing from ${project.lastIndexedCommit} to ${targetCommit}`);
    await updateIndexingProgress(context.jobId, {
      progress: 10,
      currentFile: 'Analyzing changes...',
    });

    const diff = await getGitDiff(context.repoPath, project.lastIndexedCommit, targetCommit);

    // Delete vectors for deleted and renamed files
    await processDeletedFiles(context.projectId, diff.deletedFiles, diff.renamedFiles);

    // Get files that need processing (new + modified + renamed destinations)
    filesToProcess = [
      ...diff.addedFiles,
      ...diff.modifiedFiles,
      ...diff.renamedFiles.map((r) => r.to),
    ]
      .filter((file) => {
        const fullPath = path.join(context.repoPath, file);
        return shouldIndex(path.basename(file)) && !shouldSkip(path.basename(file), fullPath);
      })
      .map((file) => path.join(context.repoPath, file));

    console.log(`Found ${filesToProcess.length} changed files to process`);
  }

  context.totalFiles = filesToProcess.length;

  await updateIndexingProgress(context.jobId, {
    progress: 15,
    totalFiles: filesToProcess.length,
    processedFiles: 0,
  });

  if (context.cancelled) {
    await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
    return;
  }

  // Step 3: Process changed files
  for (let i = 0; i < filesToProcess.length; i++) {
    if (context.cancelled) {
      await updateIndexingProgress(context.jobId, { status: 'CANCELLED' });
      return;
    }

    const file = filesToProcess[i];
    const relativePath = path.relative(context.repoPath, file);

    await updateIndexingProgress(context.jobId, {
      currentFile: relativePath,
      processedFiles: i,
      progress: 15 + Math.round((i / filesToProcess.length) * 80),
    });

    try {
      // For modified files, delete old vectors first
      if (project.lastIndexedCommit) {
        await deleteSource({
          source: relativePath,
          project_id: context.projectId,
          scope: 'project',
        });
      }

      const result = await processFile(context.projectId, file, relativePath);
      vectorCount += result.vectors_added;
      context.processedFiles = i + 1;
    } catch (error) {
      console.warn(`Failed to process file ${relativePath}:`, error);
      // Continue with other files
    }
  }

  // Step 4: Complete incremental indexing
  await updateIndexingProgress(context.jobId, {
    progress: 100,
    status: 'COMPLETED',
    processedFiles: filesToProcess.length,
    vectorsAdded: vectorCount,
  });

  // Get current project to calculate new totals
  const currentProject = await getProject(context.projectId);
  const newVectorCount = (currentProject?.vectorCount || 0) + vectorCount;

  // For incremental indexing, we need to get the total file count from the repo
  const allFiles = await scanFiles(context.repoPath);

  // Update project with new commit tracking and updated statistics
  await updateProject(context.projectId, {
    lastIndexedCommit: targetCommit,
    lastIndexedBranch: targetBranch,
    fileCount: allFiles.length,
    vectorCount: newVectorCount,
    indexedAt: new Date(),
  });

  // Mark indexing job as completed
  await updateIndexingProgress(context.jobId, {
    status: 'COMPLETED',
    progress: 100,
    processedFiles: filesToProcess.length,
    vectorsAdded: vectorCount,
  });

  console.log(
    `Incremental indexing completed: ${filesToProcess.length} files processed, ${vectorCount} vectors added/updated`
  );
}

// Git utility functions
async function setupRepositoryForIncremental(
  gitRepo: string,
  targetPath: string,
  branch: string
): Promise<void> {
  // Check if repository already exists
  try {
    await fs.access(path.join(targetPath, '.git'));
    // Repository exists, fetch latest changes
    console.log('Repository exists, fetching latest changes...');
    await execAsync(`cd "${targetPath}" && git fetch origin`, { timeout: 300000 });
    await execAsync(`cd "${targetPath}" && git checkout ${branch}`, { timeout: 60000 });
    await execAsync(`cd "${targetPath}" && git pull origin ${branch}`, { timeout: 300000 });
  } catch {
    // Repository doesn't exist, clone it
    console.log('Repository not found, cloning...');
    await cloneRepository(gitRepo, targetPath);
    if (branch !== 'main' && branch !== 'master') {
      try {
        await execAsync(`cd "${targetPath}" && git checkout ${branch}`, { timeout: 60000 });
      } catch (error) {
        console.warn(`Failed to checkout branch ${branch}, staying on default branch`);
      }
    }
  }
}

async function getCurrentCommitHash(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd "${repoPath}" && git rev-parse HEAD`);
    return stdout.trim();
  } catch (error) {
    console.warn('Failed to get current commit hash:', error);
    return 'unknown';
  }
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd "${repoPath}" && git rev-parse --abbrev-ref HEAD`);
    return stdout.trim();
  } catch (error) {
    console.warn('Failed to get current branch:', error);
    return 'unknown';
  }
}

async function getGitDiff(
  repoPath: string,
  fromCommit: string,
  toCommit: string
): Promise<GitDiffResult> {
  try {
    const { stdout } = await execAsync(
      `cd "${repoPath}" && git diff --name-status ${fromCommit}..${toCommit}`
    );

    const result: GitDiffResult = {
      addedFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      renamedFiles: [],
    };

    const lines = stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const [status, ...pathParts] = line.split('\t');

      if (status === 'A') {
        result.addedFiles.push(pathParts[0]);
      } else if (status === 'M') {
        result.modifiedFiles.push(pathParts[0]);
      } else if (status === 'D') {
        result.deletedFiles.push(pathParts[0]);
      } else if (status.startsWith('R')) {
        // Renamed file: R095  old/path  new/path
        if (pathParts.length >= 2) {
          result.renamedFiles.push({
            from: pathParts[0],
            to: pathParts[1],
          });
        }
      } else if (status.startsWith('C')) {
        // Copied file - treat as added
        result.addedFiles.push(pathParts[pathParts.length - 1]);
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to get git diff:', error);
    throw new Error(`Failed to get git diff: ${error}`);
  }
}

async function processDeletedFiles(
  projectId: string,
  deletedFiles: string[],
  renamedFiles: Array<{ from: string; to: string }>
): Promise<void> {
  // Delete vectors for deleted files
  for (const file of deletedFiles) {
    try {
      await deleteSource({
        source: file,
        project_id: projectId,
        scope: 'project',
      });
      console.log(`Deleted vectors for removed file: ${file}`);
    } catch (error) {
      console.warn(`Failed to delete vectors for file ${file}:`, error);
    }
  }

  // Delete vectors for renamed files (old paths)
  for (const rename of renamedFiles) {
    try {
      await deleteSource({
        source: rename.from,
        project_id: projectId,
        scope: 'project',
      });
      console.log(`Deleted vectors for renamed file: ${rename.from} -> ${rename.to}`);
    } catch (error) {
      console.warn(`Failed to delete vectors for renamed file ${rename.from}:`, error);
    }
  }
}

// MCP Tool Functions for Manual Indexing Operations

// Get current git commit hash for a repository
async function getCurrentCommit(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd "${repoPath}" && git rev-parse HEAD`);
    return stdout.trim();
  } catch (error) {
    console.error('Failed to get current commit:', error);
    throw new Error(`Failed to get current commit: ${error}`);
  }
}

// Index a single file - for when users want to index specific files before git push
export async function indexSingleFile(
  projectId: string,
  gitRepo: string,
  filePath: string,
  branch: string = 'main'
): Promise<{ success: boolean; vectors_added: number; message: string }> {
  console.log(`Starting single file indexing for project ${projectId}: ${filePath}`);

  try {
    // Get project info
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Setup repository
    const tempDir = path.join(os.tmpdir(), `ideamem_single_${projectId}_${Date.now()}`);
    await setupRepositoryForIncremental(gitRepo, tempDir, branch);

    const fullFilePath = path.join(tempDir, filePath);

    // Check if file exists
    try {
      await fs.access(fullFilePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check if file should be indexed
    if (
      !shouldIndex(path.basename(filePath)) ||
      shouldSkip(path.basename(filePath), fullFilePath)
    ) {
      return {
        success: false,
        vectors_added: 0,
        message: `File type not supported for indexing: ${filePath}`,
      };
    }

    // Process the file
    const result = await processFile(projectId, fullFilePath, filePath);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    console.log(
      `Single file indexing completed: ${filePath}, ${result.vectors_added} vectors added`
    );

    return {
      success: true,
      vectors_added: result.vectors_added,
      message: `Successfully indexed ${filePath} with ${result.vectors_added} vectors`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Single file indexing failed:`, error);
    return {
      success: false,
      vectors_added: 0,
      message: `Failed to index file: ${errorMessage}`,
    };
  }
}

// Reindex an existing file - removes old vectors and reindexes
export async function reindexSingleFile(
  projectId: string,
  gitRepo: string,
  filePath: string,
  branch: string = 'main'
): Promise<{ success: boolean; vectors_added: number; message: string }> {
  console.log(`Starting single file reindexing for project ${projectId}: ${filePath}`);

  try {
    // First delete existing vectors for this file
    await deleteSource({
      source: filePath,
      project_id: projectId,
      scope: 'project',
    });

    // Then index the file fresh
    const result = await indexSingleFile(projectId, gitRepo, filePath, branch);

    if (result.success) {
      result.message = `Successfully reindexed ${filePath} with ${result.vectors_added} vectors`;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Single file reindexing failed:`, error);
    return {
      success: false,
      vectors_added: 0,
      message: `Failed to reindex file: ${errorMessage}`,
    };
  }
}

// Full project reindex - clears all project vectors and reindexes everything
export async function fullReindex(
  projectId: string,
  gitRepo: string,
  branch: string = 'main'
): Promise<{ success: boolean; message: string }> {
  console.log(`Starting full reindex for project ${projectId}`);

  try {
    // Get project info
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Cancel any existing indexing job
    if (runningJobs.has(projectId)) {
      const context = runningJobs.get(projectId)!;
      context.cancelled = true;
      runningJobs.delete(projectId);
    }

    // Clear all existing project vectors
    // Note: We'll need to implement a function to delete all vectors for a project
    try {
      await deleteProjectVectors(projectId);
    } catch (error) {
      console.warn('Failed to clear existing vectors, continuing with reindex:', error);
    }

    // Start fresh full indexing
    await startCodebaseIndexing(projectId, gitRepo);

    return {
      success: true,
      message: `Full reindex started for project ${project.name}. Check project status for progress.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Full reindex failed:`, error);
    return {
      success: false,
      message: `Failed to start full reindex: ${errorMessage}`,
    };
  }
}

// Scheduled incremental indexing - checks for new commits and indexes changes
export async function scheduledIncrementalIndexing(
  projectId: string,
  gitRepo: string,
  branch: string = 'main'
): Promise<{ success: boolean; action: string; message: string }> {
  console.log(`Checking for changes in project ${projectId}`);

  try {
    // Get project info
    const project = await getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Setup repository to check current commit
    const tempDir = path.join(os.tmpdir(), `ideamem_check_${projectId}_${Date.now()}`);
    await setupRepositoryForIncremental(gitRepo, tempDir, branch);

    // Get current commit
    const currentCommit = await getCurrentCommit(tempDir);

    // Check if we're on the same commit as last indexed
    if (project.lastIndexedCommit === currentCommit) {
      // Cleanup and return - no changes
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        action: 'no_changes',
        message: `No new commits found. Project is up to date (commit: ${currentCommit.substring(0, 7)})`,
      };
    }

    // Cleanup temp directory before starting incremental indexing
    await fs.rm(tempDir, { recursive: true, force: true });

    // We have new commits - start incremental indexing
    if (!project.lastIndexedCommit) {
      // No previous commit recorded - do full indexing
      await startCodebaseIndexing(projectId, gitRepo);

      return {
        success: true,
        action: 'full_index',
        message: `No previous indexing found. Started full indexing for commit ${currentCommit.substring(0, 7)}`,
      };
    } else {
      // Start incremental indexing from last indexed commit to current
      await startIncrementalIndexing(projectId, gitRepo, currentCommit, branch);

      return {
        success: true,
        action: 'incremental_index',
        message: `New commits detected. Started incremental indexing from ${project.lastIndexedCommit.substring(0, 7)} to ${currentCommit.substring(0, 7)}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Scheduled incremental indexing failed:`, error);
    return {
      success: false,
      action: 'error',
      message: `Failed to check for changes: ${errorMessage}`,
    };
  }
}

// Helper function to delete all vectors for a project
async function deleteProjectVectors(projectId: string): Promise<void> {
  console.log(`Clearing all vectors for project ${projectId}`);

  try {
    const result = await deleteAllProjectVectors(projectId);
    console.log(
      `Successfully deleted all vectors for project ${projectId}. Deleted count: ${result.deleted_count}`
    );
  } catch (error) {
    console.warn('Failed to clear project vectors:', error);
    throw error;
  }
}
