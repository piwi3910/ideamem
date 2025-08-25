import { prisma } from './database';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface DocumentationRepository {
  id: string;
  name: string;
  url: string;
  branch: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  lastIndexedCommit: string | null;
  lastIndexedAt: Date | null;
  autoReindexEnabled: boolean;
  reindexInterval: number;
  nextReindexAt: Date | null;
  description: string | null;
  language: string | null;
  isActive: boolean;
  totalDocuments: number;
  lastIndexingDuration: number | null;
  lastIndexingStatus: string | null;
  lastIndexingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentationRepositoryData {
  name: string;
  url: string;
  branch?: string;
  sourceType?: 'git' | 'llmstxt' | 'website';
  description?: string;
  language?: string;
  autoReindexEnabled?: boolean;
  reindexInterval?: number;
}

export interface UpdateDocumentationRepositoryData {
  name?: string;
  url?: string;
  branch?: string;
  description?: string;
  language?: string;
  autoReindexEnabled?: boolean;
  reindexInterval?: number;
  isActive?: boolean;
}

// Get all documentation repositories
export async function getAllDocumentationRepositories(): Promise<DocumentationRepository[]> {
  const repositories = await prisma.documentationRepository.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return repositories as DocumentationRepository[];
}

// Get active documentation repositories (for scheduling)
export async function getActiveDocumentationRepositories(): Promise<DocumentationRepository[]> {
  const repositories = await prisma.documentationRepository.findMany({
    where: { 
      isActive: true,
      autoReindexEnabled: true,
    },
    orderBy: { nextReindexAt: 'asc' },
  });
  return repositories as DocumentationRepository[];
}

// Get a specific documentation repository
export async function getDocumentationRepository(id: string): Promise<DocumentationRepository | null> {
  const repository = await prisma.documentationRepository.findUnique({
    where: { id },
  });
  return repository as DocumentationRepository | null;
}

// Create a new documentation repository
export async function createDocumentationRepository(
  data: CreateDocumentationRepositoryData
): Promise<DocumentationRepository> {
  const repository = await prisma.documentationRepository.create({
    data: {
      name: data.name,
      url: data.url,
      branch: data.branch || 'main',
      sourceType: data.sourceType || 'git',
      description: data.description,
      language: data.language,
      autoReindexEnabled: data.autoReindexEnabled || false,
      reindexInterval: data.reindexInterval || 14, // 14 days default
      nextReindexAt: data.autoReindexEnabled 
        ? new Date(Date.now() + (data.reindexInterval || 14) * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  return repository as DocumentationRepository;
}

// Update a documentation repository
export async function updateDocumentationRepository(
  id: string,
  data: UpdateDocumentationRepositoryData
): Promise<DocumentationRepository> {
  const updateData: any = { ...data };

  // If reindexInterval is updated and autoReindexEnabled is true, update nextReindexAt
  if (data.reindexInterval !== undefined || data.autoReindexEnabled !== undefined) {
    const current = await getDocumentationRepository(id);
    if (current) {
      const enabled = data.autoReindexEnabled !== undefined ? data.autoReindexEnabled : current.autoReindexEnabled;
      const interval = data.reindexInterval !== undefined ? data.reindexInterval : current.reindexInterval;
      
      if (enabled) {
        updateData.nextReindexAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
      } else {
        updateData.nextReindexAt = null;
      }
    }
  }

  const updatedRepository = await prisma.documentationRepository.update({
    where: { id },
    data: updateData,
  });
  return updatedRepository as DocumentationRepository;
}

// Delete a documentation repository
export async function deleteDocumentationRepository(id: string): Promise<void> {
  await prisma.documentationRepository.delete({
    where: { id },
  });
}

// Git operations for tracking commits
export async function getLatestGitCommit(repositoryUrl: string, branch: string = 'main'): Promise<string> {
  const tempDir = path.join(tmpdir(), `doc-repo-${Date.now()}`);
  
  try {
    // Clone the repository (shallow clone for efficiency)
    await execAsync(`git clone --depth 1 --branch ${branch} ${repositoryUrl} ${tempDir}`);
    
    // Get the latest commit hash
    const { stdout } = await execAsync(`cd ${tempDir} && git rev-parse HEAD`);
    
    return stdout.trim();
  } catch (error) {
    console.error('Failed to get latest git commit:', error);
    throw new Error(`Failed to get latest commit from ${repositoryUrl}:${branch}`);
  } finally {
    // Cleanup temp directory
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory:', tempDir);
    }
  }
}

// Check if repository needs reindexing (based on commit changes)
export async function checkIfRepositoryNeedsReindexing(repository: DocumentationRepository): Promise<{
  needsReindexing: boolean;
  latestCommit?: string;
  reason: string;
}> {
  if (repository.sourceType !== 'git') {
    return {
      needsReindexing: true,
      reason: 'Non-git sources always need reindexing check',
    };
  }

  try {
    const latestCommit = await getLatestGitCommit(repository.url, repository.branch);
    
    if (!repository.lastIndexedCommit) {
      return {
        needsReindexing: true,
        latestCommit,
        reason: 'Repository never indexed before',
      };
    }

    if (repository.lastIndexedCommit !== latestCommit) {
      return {
        needsReindexing: true,
        latestCommit,
        reason: `New commits available (${repository.lastIndexedCommit.slice(0, 7)} -> ${latestCommit.slice(0, 7)})`,
      };
    }

    return {
      needsReindexing: false,
      latestCommit,
      reason: 'Repository up to date',
    };
  } catch (error) {
    console.error(`Failed to check repository ${repository.name}:`, error);
    return {
      needsReindexing: false,
      reason: `Failed to check repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Update repository after successful indexing
export async function updateRepositoryAfterIndexing(
  repositoryId: string,
  success: boolean,
  stats?: {
    commitHash?: string;
    totalDocuments?: number;
    duration?: number;
    error?: string;
  }
): Promise<DocumentationRepository> {
  const updateData: any = {
    lastIndexedAt: new Date(),
    lastIndexingStatus: success ? 'SUCCESS' : 'FAILED',
    lastIndexingError: stats?.error || null,
  };

  if (stats?.commitHash) {
    updateData.lastIndexedCommit = stats.commitHash;
  }

  if (stats?.totalDocuments !== undefined) {
    updateData.totalDocuments = stats.totalDocuments;
  }

  if (stats?.duration !== undefined) {
    updateData.lastIndexingDuration = stats.duration;
  }

  // Update next reindex time if auto-reindexing is enabled
  const repository = await getDocumentationRepository(repositoryId);
  if (repository?.autoReindexEnabled && success) {
    updateData.nextReindexAt = new Date(Date.now() + repository.reindexInterval * 24 * 60 * 60 * 1000);
  }

  const updatedRepo = await prisma.documentationRepository.update({
    where: { id: repositoryId },
    data: updateData,
  });
  return updatedRepo as DocumentationRepository;
}

// Get repositories due for reindexing
export async function getRepositoriesDueForReindexing(): Promise<DocumentationRepository[]> {
  const now = new Date();
  
  const repositories = await prisma.documentationRepository.findMany({
    where: {
      isActive: true,
      autoReindexEnabled: true,
      nextReindexAt: {
        lte: now,
      },
    },
    orderBy: { nextReindexAt: 'asc' },
  });
  return repositories as DocumentationRepository[];
}