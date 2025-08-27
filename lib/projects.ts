import { prisma, initializeDatabase } from './database';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type {
  Project as PrismaProject,
  IndexingJob as PrismaIndexingJob,
  IndexStatus,
  JobStatus,
  TriggerType,
} from './generated/prisma';

// Export the Prisma types
export type { IndexStatus, JobStatus, TriggerType };
export type Project = PrismaProject;
export type IndexingJob = PrismaIndexingJob;

// Type for creating a new project
export type CreateProjectData = {
  name: string;
  gitRepo: string;
  description?: string;
};

// Type for updating project
export type UpdateProjectData = Partial<Omit<Project, 'id' | 'token' | 'createdAt'>>;

// Project CRUD operations
export async function createProject(data: CreateProjectData): Promise<Project> {
  await initializeDatabase();

  const token = `idm_${crypto.randomBytes(16).toString('hex')}`;

  return await prisma.project.create({
    data: {
      name: data.name,
      gitRepo: data.gitRepo,
      description: data.description,
      token,
    },
  });
}

export async function getProjects(): Promise<Project[]> {
  await initializeDatabase();
  return await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProject(id: string): Promise<Project | null> {
  await initializeDatabase();
  return await prisma.project.findUnique({
    where: { id },
  });
}

export async function getProjectByToken(token: string): Promise<Project | null> {
  await initializeDatabase();
  return await prisma.project.findUnique({
    where: { token },
  });
}

export async function updateProject(
  id: string,
  updates: UpdateProjectData
): Promise<Project | null> {
  await initializeDatabase();

  try {
    return await prisma.project.update({
      where: { id },
      data: updates,
    });
  } catch {
    return null;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  await initializeDatabase();

  try {
    // Use ProjectService for comprehensive deletion
    const { ProjectService } = await import('./services/project-service');
    await ProjectService.getInstance().deleteProject(id);
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

export async function regenerateToken(id: string): Promise<string | null> {
  await initializeDatabase();

  const newToken = `idm_${crypto.randomBytes(16).toString('hex')}`;

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { token: newToken },
    });
    return project.token;
  } catch {
    return null;
  }
}

// Indexing job management
export async function startIndexingJob(
  projectId: string,
  options: {
    branch?: string;
    fullReindex?: boolean;
    triggeredBy?: TriggerType;
  } = {}
): Promise<IndexingJob> {
  await initializeDatabase();

  // Cancel any existing running job
  await prisma.indexingJob.updateMany({
    where: {
      projectId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: {
      indexStatus: 'INDEXING',
      indexProgress: 0,
    },
  });

  // Create new job
  const job = await prisma.indexingJob.create({
    data: {
      projectId,
      branch: options.branch ?? 'main',
      fullReindex: options.fullReindex ?? false,
      triggeredBy: options.triggeredBy ?? 'MANUAL',
      status: 'PENDING',
    },
  });

  // Queue the job in BullMQ
  try {
    const { QueueManager } = await import('./queue');
    await QueueManager.addIndexingJob({
      projectId,
      jobId: job.id,
      branch: options.branch ?? 'main',
      fullReindex: options.fullReindex ?? false,
      triggeredBy: options.triggeredBy ?? 'MANUAL',
    });
  } catch (error) {
    console.error('Failed to queue indexing job:', error);
    // Update job status to failed if queuing fails
    await updateIndexingProgress(job.id, {
      status: 'FAILED',
      errorMessage: 'Failed to queue job: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
    throw error;
  }

  return job;
}

export async function updateIndexingProgress(
  jobId: string,
  updates: {
    progress?: number;
    currentFile?: string;
    totalFiles?: number;
    processedFiles?: number;
    errorCount?: number;
    vectorsAdded?: number;
    status?: JobStatus;
    errorMessage?: string;
  }
): Promise<void> {
  await initializeDatabase();

  const updateData: any = { ...updates };

  if (updates.status === 'RUNNING' && !updateData.startedAt) {
    updateData.startedAt = new Date();
  }

  if (updates.status && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(updates.status)) {
    updateData.completedAt = new Date();
  }

  // Update the job
  const job = await prisma.indexingJob.update({
    where: { id: jobId },
    data: updateData,
  });

  // Update project status if needed
  if (updates.status) {
    let projectStatus: IndexStatus = 'INDEXING';

    if (updates.status === 'COMPLETED') {
      projectStatus = 'COMPLETED';
    } else if (updates.status === 'FAILED') {
      projectStatus = 'ERROR';
    } else if (updates.status === 'CANCELLED') {
      projectStatus = 'IDLE';
    }

    const projectUpdate: any = {
      indexStatus: projectStatus,
    };

    if (updates.progress !== undefined) {
      projectUpdate.indexProgress = updates.progress;
    }

    if (updates.status === 'COMPLETED') {
      projectUpdate.indexedAt = new Date();
    }

    await prisma.project.update({
      where: { id: job.projectId },
      data: projectUpdate,
    });
  }
}

export async function getIndexingJob(projectId: string): Promise<IndexingJob | null> {
  await initializeDatabase();

  return await prisma.indexingJob.findFirst({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getActiveIndexingJob(projectId: string): Promise<IndexingJob | null> {
  await initializeDatabase();

  return await prisma.indexingJob.findFirst({
    where: {
      projectId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function cancelIndexingJob(projectId: string): Promise<boolean> {
  await initializeDatabase();

  try {
    await prisma.indexingJob.updateMany({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { indexStatus: 'IDLE' },
    });

    return true;
  } catch {
    return false;
  }
}

// Webhook management
export async function toggleWebhook(projectId: string, enabled: boolean): Promise<Project | null> {
  return await updateProject(projectId, { webhookEnabled: enabled });
}

export function getWebhookUrl(projectId: string, baseUrl?: string): string {
  const base =
    baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${base}/api/webhooks/${projectId}`;
}

// Usage tracking
export async function trackQuery(projectId: string): Promise<void> {
  await initializeDatabase();

  const now = new Date();

  await prisma.project.update({
    where: { id: projectId },
    data: {
      totalQueries: { increment: 1 },
      queriesThisWeek: { increment: 1 },
      queriesThisMonth: { increment: 1 },
      lastQueryAt: now,
    },
  });
}

// Scheduled indexing
export async function configureScheduledIndexing(
  projectId: string,
  config: {
    enabled: boolean;
    branch?: string;
    interval?: number; // minutes
  }
): Promise<Project | null> {
  await initializeDatabase();

  const updateData: any = {
    scheduledIndexingEnabled: config.enabled,
  };

  if (config.branch) {
    updateData.scheduledIndexingBranch = config.branch;
  }

  if (config.interval) {
    updateData.scheduledIndexingInterval = config.interval;
  }

  if (config.enabled) {
    // Set next run time
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + (config.interval || 60));
    updateData.scheduledIndexingNextRun = nextRun;
    
    // Add to BullMQ scheduled queue
    try {
      const { QueueManager } = await import('./queue');
      await QueueManager.addScheduledIndexingJob({
        projectId,
        branch: config.branch || 'main',
        interval: config.interval || 60,
      });
    } catch (error) {
      console.error('Failed to schedule indexing job:', error);
      throw error;
    }
  } else {
    updateData.scheduledIndexingNextRun = null;
    
    // Remove from BullMQ scheduled queue
    try {
      const { QueueManager } = await import('./queue');
      await QueueManager.removeScheduledIndexingJob(projectId);
    } catch (error) {
      console.error('Failed to remove scheduled indexing job:', error);
      // Don't throw error for removal as it's not critical
    }
  }

  return await updateProject(projectId, updateData);
}

export async function updateScheduledIndexingRun(
  projectId: string,
  success: boolean,
  nextInterval?: number
): Promise<void> {
  await initializeDatabase();

  const project = await getProject(projectId);
  if (!project) return;

  const interval = nextInterval || project.scheduledIndexingInterval;
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + interval);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      scheduledIndexingLastRun: new Date(),
      scheduledIndexingNextRun: project.scheduledIndexingEnabled ? nextRun : null,
    },
  });
}

export async function getProjectsNeedingScheduledIndexing(): Promise<Project[]> {
  await initializeDatabase();

  const now = new Date();

  return await prisma.project.findMany({
    where: {
      scheduledIndexingEnabled: true,
      scheduledIndexingNextRun: {
        lte: now,
      },
      // Don't run if already indexing
      indexStatus: { not: 'INDEXING' },
    },
  });
}

// Statistics and reporting
export async function getProjectStats(projectId: string) {
  await initializeDatabase();

  const project = await getProject(projectId);
  if (!project) return null;

  const completedJobs = await prisma.indexingJob.count({
    where: {
      projectId,
      status: 'COMPLETED',
    },
  });

  const failedJobs = await prisma.indexingJob.count({
    where: {
      projectId,
      status: 'FAILED',
    },
  });

  const recentJobs = await prisma.indexingJob.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });

  return {
    project,
    completedJobs,
    failedJobs,
    recentJobs,
    successRate:
      completedJobs + failedJobs > 0 ? (completedJobs / (completedJobs + failedJobs)) * 100 : 0,
  };
}
