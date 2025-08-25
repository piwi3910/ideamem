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

// Queue names
export const QUEUE_NAMES = {
  INDEXING: 'indexing',
  SCHEDULED_INDEXING: 'scheduled-indexing',
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
      [QUEUE_NAMES.CLEANUP]: new Queue(QUEUE_NAMES.CLEANUP, getQueueConfig(QUEUE_NAMES.CLEANUP)),
    };
  }
  return queues;
}

// Queue management functions
export class QueueManager {
  private static queues = getQueues();

  // Add indexing job
  static async addIndexingJob(data: IndexingJobData, priority: number = JOB_PRIORITIES.NORMAL) {
    const queue = this.queues[QUEUE_NAMES.INDEXING];
    
    return await queue.add(
      'process-indexing',
      data,
      {
        priority,
        jobId: data.jobId, // Use our job ID as BullMQ job ID
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