import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';

// Job data types
export interface IndexingJobData {
  projectId: string;
  jobId: string;
  branch?: string;
  fullReindex?: boolean;
  triggeredBy?: string;
}

export interface ScheduledIndexingJobData {
  projectId: string;
  branch: string;
  interval: number;
}

export interface DocumentationIndexingJobData {
  repositoryId: string;
  repositoryUrl: string;
  branch: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  forceReindex?: boolean; // Override git commit checking
  jobId?: string; // Database job ID for tracking
}

// Queue names
export const QUEUE_NAMES = {
  INDEXING: 'indexing',
  SCHEDULED_INDEXING: 'scheduled-indexing',
  DOCUMENTATION_INDEXING: 'documentation-indexing',
  CLEANUP: 'cleanup',
} as const;

// Job priorities
export const JOB_PRIORITIES = {
  HIGH: 10,
  NORMAL: 5,
  LOW: 1,
} as const;

// Queue configurations
const getQueueConfig = (name: string): QueueOptions => ({
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 20, // Keep last 20 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

const getWorkerConfig = (name: string): WorkerOptions => ({
  connection: getRedisConnection(),
  concurrency: name === QUEUE_NAMES.INDEXING ? 2 : 1, // Limit concurrent indexing jobs
  maxStalledCount: 1,
  stalledInterval: 30000, // 30 seconds
});

// Redis connection for BullMQ
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return {
    host: redisUrl.includes('localhost') ? 'localhost' : new URL(redisUrl).hostname,
    port: redisUrl.includes('localhost') ? 6379 : parseInt(new URL(redisUrl).port) || 6379,
    password: redisUrl.includes('@') ? new URL(redisUrl).password : undefined,
  };
}

// Queue instances
let queues: Record<string, Queue> | null = null;
let workers: Record<string, Worker> | null = null;

export function getQueues(): Record<string, Queue> {
  if (!queues) {
    queues = {
      [QUEUE_NAMES.INDEXING]: new Queue(QUEUE_NAMES.INDEXING, getQueueConfig(QUEUE_NAMES.INDEXING)),
      [QUEUE_NAMES.SCHEDULED_INDEXING]: new Queue(QUEUE_NAMES.SCHEDULED_INDEXING, getQueueConfig(QUEUE_NAMES.SCHEDULED_INDEXING)),
      [QUEUE_NAMES.DOCUMENTATION_INDEXING]: new Queue(QUEUE_NAMES.DOCUMENTATION_INDEXING, getQueueConfig(QUEUE_NAMES.DOCUMENTATION_INDEXING)),
      [QUEUE_NAMES.CLEANUP]: new Queue(QUEUE_NAMES.CLEANUP, getQueueConfig(QUEUE_NAMES.CLEANUP)),
    };
  }
  return queues;
}

// Queue management functions
export class QueueManager {
  private static queues = getQueues();

  // Add indexing job (with deduplication)
  static async addIndexingJob(data: IndexingJobData, priority: number = JOB_PRIORITIES.NORMAL) {
    const queue = this.queues[QUEUE_NAMES.INDEXING];
    
    // Use project ID as job ID to prevent duplicates
    const jobId = `project-${data.projectId}`;
    
    // Check if job already exists
    try {
      const existingJob = await queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        console.log(`Found existing job ${jobId} with state: ${state}`);
        if (!['completed', 'failed'].includes(state)) {
          // Check if job is stuck (older than 10 minutes and not active)
          const jobAge = Date.now() - existingJob.timestamp;
          const isStuck = jobAge > 10 * 60 * 1000; // 10 minutes
          
          if (isStuck && state !== 'active') {
            console.log(`Job ${jobId} appears stuck (age: ${Math.round(jobAge/60000)}min, state: ${state}), removing and creating new job`);
            await existingJob.remove();
          } else {
            console.log(`Indexing job already exists for project ${data.projectId}, skipping duplicate. Job state: ${state}`);
            return existingJob;
          }
        } else {
          console.log(`Existing job ${jobId} is ${state}, removing completed/failed job before creating new one`);
          await existingJob.remove();
        }
      } else {
        console.log(`No existing job found for ${jobId}, will create new job`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Error checking for existing job ${jobId}:`, errorMessage);
      // Job doesn't exist, continue
    }
    
    return await queue.add(
      'process-indexing',
      data,
      {
        priority,
        jobId,
        delay: 0,
      }
    );
  }

  // Add scheduled indexing job
  static async addScheduledIndexingJob(data: ScheduledIndexingJobData) {
    const queue = this.queues[QUEUE_NAMES.SCHEDULED_INDEXING];
    
    return await queue.add(
      'process-scheduled-indexing',
      data,
      {
        priority: JOB_PRIORITIES.LOW,
        repeat: {
          every: data.interval * 60 * 1000, // Convert minutes to milliseconds
        },
        jobId: `scheduled-${data.projectId}`, // Unique ID for scheduled job
      }
    );
  }

  // Remove scheduled indexing job
  static async removeScheduledIndexingJob(projectId: string) {
    const queue = this.queues[QUEUE_NAMES.SCHEDULED_INDEXING];
    
    // Remove repeatable job
    const jobId = `scheduled-${projectId}`;
    const repeatableJobs = await queue.getRepeatableJobs();
    
    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.id === jobId) {
        await queue.removeRepeatableByKey(repeatableJob.key);
      }
    }
  }

  // Add documentation indexing job (with deduplication)
  static async addDocumentationIndexingJob(data: DocumentationIndexingJobData, priority: number = JOB_PRIORITIES.NORMAL) {
    const queue = this.queues[QUEUE_NAMES.DOCUMENTATION_INDEXING];
    
    // Use repository ID as job ID to prevent duplicates
    const jobId = `doc-${data.repositoryId}`;
    
    // Check if job already exists
    try {
      const existingJob = await queue.getJob(jobId);
      if (existingJob && !['completed', 'failed'].includes(await existingJob.getState())) {
        console.log(`Documentation indexing job already exists for repository ${data.repositoryId}, skipping duplicate`);
        return existingJob;
      }
    } catch (error) {
      // Job doesn't exist, continue
    }
    
    return await queue.add(
      'process-documentation-indexing',
      data,
      {
        priority,
        jobId, // Use consistent ID for deduplication
        delay: 0,
      }
    );
  }

  // Add scheduled documentation indexing job
  static async addScheduledDocumentationIndexingJob(interval: number) {
    const queue = this.queues[QUEUE_NAMES.DOCUMENTATION_INDEXING];
    
    return await queue.add(
      'process-scheduled-documentation-indexing',
      { checkInterval: true },
      {
        priority: JOB_PRIORITIES.LOW,
        repeat: {
          every: interval * 24 * 60 * 60 * 1000, // Convert days to milliseconds
        },
        jobId: 'scheduled-documentation-check', // Single scheduled checker
      }
    );
  }

  // Remove scheduled documentation indexing job
  static async removeScheduledDocumentationIndexingJob() {
    const queue = this.queues[QUEUE_NAMES.DOCUMENTATION_INDEXING];
    
    const jobId = 'scheduled-documentation-check';
    const repeatableJobs = await queue.getRepeatableJobs();
    
    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.id === jobId) {
        await queue.removeRepeatableByKey(repeatableJob.key);
      }
    }
  }

  // Add cleanup job
  static async addCleanupJob(data: { type: string; targetId?: string }) {
    const queue = this.queues[QUEUE_NAMES.CLEANUP];
    
    return await queue.add(
      'process-cleanup',
      data,
      {
        priority: JOB_PRIORITIES.LOW,
        delay: 5 * 60 * 1000, // Delay 5 minutes
      }
    );
  }

  // Cancel job by ID
  static async cancelJob(jobId: string, queueName: string) {
    const queue = this.queues[queueName];
    if (!queue) return false;

    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error canceling job:', error);
      return false;
    }
  }

  // Cancel existing job for project (if any)
  static async cancelExistingProjectJob(projectId: string) {
    const queue = this.queues[QUEUE_NAMES.INDEXING];
    const jobId = `project-${projectId}`;
    
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['waiting', 'active', 'delayed'].includes(state)) {
          await job.remove();
          console.log(`Cancelled existing indexing job for project ${projectId}`);
          return true;
        }
      }
    } catch (error) {
      console.warn(`Failed to cancel existing job for project ${projectId}:`, error);
    }
    return false;
  }

  // Cancel existing job for documentation repository (if any)
  static async cancelExistingDocumentationJob(repositoryId: string) {
    const queue = this.queues[QUEUE_NAMES.DOCUMENTATION_INDEXING];
    const jobId = `doc-${repositoryId}`;
    
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (['waiting', 'active', 'delayed'].includes(state)) {
          await job.remove();
          console.log(`Cancelled existing documentation indexing job for repository ${repositoryId}`);
          return true;
        }
      }
    } catch (error) {
      console.warn(`Failed to cancel existing documentation job for repository ${repositoryId}:`, error);
    }
    return false;
  }

  // Get active jobs for a project
  static async getActiveProjectJobs(projectId: string) {
    const queue = this.queues[QUEUE_NAMES.INDEXING];
    const jobId = `project-${projectId}`;
    
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        return {
          exists: true,
          state,
          data: job.data,
          progress: job.progress,
        };
      }
    } catch (error) {
      console.warn(`Error getting active job for project ${projectId}:`, error);
    }
    
    return { exists: false };
  }

  // Get active jobs for a documentation repository
  static async getActiveDocumentationJobs(repositoryId: string) {
    const queue = this.queues[QUEUE_NAMES.DOCUMENTATION_INDEXING];
    const jobId = `doc-${repositoryId}`;
    
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        return {
          exists: true,
          state,
          data: job.data,
          progress: job.progress,
        };
      }
    } catch (error) {
      console.warn(`Error getting active documentation job for repository ${repositoryId}:`, error);
    }
    
    return { exists: false };
  }

  // Get queue statistics
  static async getQueueStats() {
    const stats: Record<string, any> = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
        ]);

        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          paused: await queue.isPaused(),
        };
      } catch (error) {
        console.error(`Error getting stats for queue ${name}:`, error);
        stats[name] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return stats;
  }

  // Pause/Resume queue
  static async pauseQueue(queueName: string) {
    const queue = this.queues[queueName];
    if (queue) {
      await queue.pause();
      return true;
    }
    return false;
  }

  static async resumeQueue(queueName: string) {
    const queue = this.queues[queueName];
    if (queue) {
      await queue.resume();
      return true;
    }
    return false;
  }

  // Clean completed/failed jobs
  static async cleanQueue(queueName: string, grace: number = 24 * 60 * 60 * 1000) {
    const queue = this.queues[queueName];
    if (!queue) return false;

    try {
      await queue.clean(grace, 100, 'completed');
      await queue.clean(grace, 100, 'failed');
      return true;
    } catch (error) {
      console.error(`Error cleaning queue ${queueName}:`, error);
      return false;
    }
  }
}

// Graceful shutdown
export async function closeQueues() {
  if (queues) {
    await Promise.all(Object.values(queues).map(queue => queue.close()));
    queues = null;
  }
  
  if (workers) {
    await Promise.all(Object.values(workers).map(worker => worker.close()));
    workers = null;
  }
}

// Process cleanup on exit
process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);