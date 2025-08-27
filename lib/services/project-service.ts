import { prisma } from '@/lib/database';
import { 
  Project,
  IndexingJob, 
  GlobalPreference,
  ProjectPreference,
  Prisma
} from '@prisma/client';
import { generateToken } from '@/lib/auth';
import { deleteAllProjectVectors } from '@/lib/memory';
import { QueueManager } from '@/lib/queue';

export interface CreateProjectData {
  name: string;
  description?: string;
  gitRepo: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  gitRepo?: string;
  indexStatus?: string;
  webhookEnabled?: boolean;
  scheduledIndexingEnabled?: boolean;
  scheduledIndexingInterval?: number;
  scheduledIndexingBranch?: string;
  lastWebhookAt?: Date;
  lastWebhookCommit?: string;
  lastWebhookBranch?: string;
  lastWebhookAuthor?: string;
}

export interface ProjectWithStats extends Project {
  _count?: {
    preferences: number;
    indexingJobs: number;
  };
  vectorCount?: number;
}

export interface IndexingJobOptions {
  branch?: string;
  fullReindex?: boolean;
  triggeredBy?: 'MANUAL' | 'WEBHOOK' | 'SCHEDULED' | 'API';
}

/**
 * Service class for all project-related operations
 */
export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  static getInstance(): ProjectService {
    if (!this.instance) {
      this.instance = new ProjectService();
    }
    return this.instance;
  }

  /**
   * Get all projects with optional stats
   */
  async getAllProjects(includeStats = false): Promise<ProjectWithStats[]> {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      ...(includeStats && {
        include: {
          _count: {
            select: {
              preferences: true,
              indexingJobs: true,
            },
          },
        },
      }),
    });

    // Add vector counts if requested
    if (includeStats) {
      // In a real implementation, you'd fetch vector counts from Qdrant
      return projects.map(project => ({
        ...project,
        vectorCount: 0, // This would be fetched from Qdrant
      }));
    }

    return projects;
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  }

  /**
   * Get a project by token
   */
  async getProjectByToken(token: string): Promise<Project | null> {
    return prisma.project.findFirst({
      where: { token },
    });
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    const token = generateToken();

    return prisma.project.create({
      data: {
        ...data,
        token,
        indexStatus: 'IDLE',
        webhookEnabled: false,
        scheduledIndexingEnabled: false,
        scheduledIndexingInterval: 60,
        scheduledIndexingBranch: 'main',
      },
    });
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: string,
    data: UpdateProjectData
  ): Promise<Project> {
    return prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  /**
   * Delete a project and all related data
   */
  async deleteProject(projectId: string): Promise<void> {
    // Delete all project vectors from Qdrant
    await deleteAllProjectVectors(projectId);

    // Cancel any pending jobs
    await QueueManager.cancelProjectJobs(projectId);

    // Delete project and cascade delete related records
    await prisma.project.delete({
      where: { id: projectId },
    });
  }

  /**
   * Regenerate project token
   */
  async regenerateToken(projectId: string): Promise<string> {
    const newToken = generateToken();
    
    await prisma.project.update({
      where: { id: projectId },
      data: { token: newToken },
    });

    return newToken;
  }

  /**
   * Get project preferences (constraints)
   */
  async getProjectPreferences(
    projectId: string,
    category?: string
  ): Promise<ProjectPreference[]> {
    return prisma.projectPreference.findMany({
      where: {
        projectId,
        ...(category && { category }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Create project preference
   */
  async createProjectPreference(
    projectId: string,
    data: {
      source: string;
      content: string;
      category: string;
    }
  ): Promise<ProjectPreference> {
    return prisma.projectPreference.create({
      data: {
        ...data,
        projectId,
      },
    });
  }

  /**
   * Update project preference
   */
  async updateProjectPreference(
    id: string,
    data: {
      source?: string;
      content?: string;
      category?: string;
    }
  ): Promise<ProjectPreference> {
    return prisma.projectPreference.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete project preference
   */
  async deleteProjectPreference(id: string): Promise<void> {
    await prisma.projectPreference.delete({
      where: { id },
    });
  }

  /**
   * Start an indexing job for a project
   */
  async startIndexingJob(
    projectId: string,
    options: IndexingJobOptions = {}
  ): Promise<IndexingJob> {
    const {
      branch = 'main',
      fullReindex = false,
      triggeredBy = 'MANUAL',
    } = options;

    // Update project status
    await this.updateProject(projectId, {
      indexStatus: 'INDEXING',
    });

    // Create indexing job
    return prisma.indexingJob.create({
      data: {
        projectId,
        status: 'PENDING',
        branch,
        fullReindex,
        triggeredBy,
        totalFiles: 0,
        processedFiles: 0,
        vectorsAdded: 0,
        vectorsUpdated: 0,
        vectorsDeleted: 0,
        progress: 0,
      },
    });
  }

  /**
   * Update indexing job status
   */
  async updateIndexingJob(
    jobId: string,
    data: Partial<IndexingJob>
  ): Promise<IndexingJob> {
    return prisma.indexingJob.update({
      where: { id: jobId },
      data,
    });
  }

  /**
   * Complete an indexing job
   */
  async completeIndexingJob(
    jobId: string,
    status: 'COMPLETED' | 'ERROR' | 'CANCELLED',
    errorMessage?: string
  ): Promise<void> {
    const job = await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: new Date(),
        ...(errorMessage && { errorMessage }),
        ...(status === 'COMPLETED' && { progress: 100 }),
      },
    });

    // Update project status
    await this.updateProject(job.projectId, {
      indexStatus: status === 'COMPLETED' ? 'COMPLETED' : 'ERROR',
      ...(status === 'COMPLETED' && {
        lastIndexedAt: new Date(),
        lastIndexedCommit: job.commitHash || undefined,
        fileCount: job.processedFiles,
        vectorCount: job.vectorsAdded + job.vectorsUpdated,
      }),
    });
  }

  /**
   * Get active indexing jobs
   */
  async getActiveIndexingJobs(
    projectId?: string
  ): Promise<IndexingJob[]> {
    return prisma.indexingJob.findMany({
      where: {
        ...(projectId && { projectId }),
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get indexing history for a project
   */
  async getIndexingHistory(
    projectId: string,
    limit = 10
  ): Promise<IndexingJob[]> {
    return prisma.indexingJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Check if project name is unique
   */
  async isProjectNameUnique(name: string, excludeId?: string): Promise<boolean> {
    const project = await prisma.project.findFirst({
      where: {
        name,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
    });
    
    return !project;
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(projectId: string): Promise<{
    totalFiles: number;
    totalVectors: number;
    lastIndexed: Date | null;
    indexingJobs: number;
    preferences: number;
  }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            preferences: true,
            indexingJobs: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return {
      totalFiles: project.fileCount || 0,
      totalVectors: project.vectorCount || 0,
      lastIndexed: project.lastIndexedAt,
      indexingJobs: project._count.indexingJobs,
      preferences: project._count.preferences,
    };
  }

  /**
   * Enable webhook for a project
   */
  async enableWebhook(
    projectId: string,
    webhookSecret?: string
  ): Promise<Project> {
    return this.updateProject(projectId, {
      webhookEnabled: true,
      ...(webhookSecret && { webhookSecret }),
    });
  }

  /**
   * Disable webhook for a project
   */
  async disableWebhook(projectId: string): Promise<Project> {
    return this.updateProject(projectId, {
      webhookEnabled: false,
      webhookSecret: null,
    });
  }

  /**
   * Configure scheduled indexing
   */
  async configureScheduledIndexing(
    projectId: string,
    config: {
      enabled: boolean;
      interval?: number;
      branch?: string;
    }
  ): Promise<Project> {
    return this.updateProject(projectId, {
      scheduledIndexingEnabled: config.enabled,
      ...(config.interval && { scheduledIndexingInterval: config.interval }),
      ...(config.branch && { scheduledIndexingBranch: config.branch }),
    });
  }

  /**
   * Track a query for metrics
   */
  async trackQuery(projectId: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        queryCount: { increment: 1 },
        lastQueryAt: new Date(),
      },
    });
  }
}

// Export singleton instance
export const projectService = ProjectService.getInstance();