import { Worker, Job } from 'bullmq';
import { updateIndexingProgress, getProject } from './projects';
import { startIncrementalIndexing, scheduledIncrementalIndexing, fullReindex as fullReindexFunction } from './indexing';
import { QUEUE_NAMES, IndexingJobData, ScheduledIndexingJobData } from './queue';

// Worker configurations
const WORKER_CONFIG = {
  connection: {
    host: process.env.REDIS_URL?.includes('localhost') ? 'localhost' : process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
    port: process.env.REDIS_URL?.includes('localhost') ? 6379 : process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
    password: process.env.REDIS_URL?.includes('@') ? new URL(process.env.REDIS_URL).password : undefined,
  },
  concurrency: 1,
  maxStalledCount: 1,
  stalledInterval: 30000,
};

// Indexing job processor
export function createIndexingWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.INDEXING,
    async (job: Job<IndexingJobData>) => {
      const { projectId, jobId, branch = 'main', fullReindex = false } = job.data;
      
      console.log(`Processing indexing job ${jobId} for project ${projectId}`);
      
      try {
        // Update job status to running
        await updateIndexingProgress(jobId, { status: 'RUNNING' });
        
        // Get project details
        const project = await getProject(projectId);
        if (!project) {
          throw new Error(`Project ${projectId} not found`);
        }

        // Progress callback to update job progress
        const onProgress = async (progress: number, currentFile?: string, totalFiles?: number, processedFiles?: number) => {
          await updateIndexingProgress(jobId, {
            progress,
            currentFile,
            totalFiles,
            processedFiles,
          });
          
          // Update BullMQ job progress as well
          await job.updateProgress(progress);
        };

        // Run the indexing based on type
        let result;
        if (fullReindex) {
          result = await fullReindexFunction(projectId, project.gitRepo);
        } else {
          // For incremental indexing, we need to use startIncrementalIndexing
          // which expects a target commit. For now, let's use 'HEAD'
          await startIncrementalIndexing(projectId, project.gitRepo, 'HEAD', branch);
          result = { message: 'Incremental indexing started', totalVectorsAdded: 0, totalFilesProcessed: 0, totalFilesFound: 0 };
        }

        // Update final status
        await updateIndexingProgress(jobId, {
          status: 'COMPLETED',
          progress: 100,
          vectorsAdded: 'totalVectorsAdded' in result ? result.totalVectorsAdded : 0,
          processedFiles: 'totalFilesProcessed' in result ? result.totalFilesProcessed : 0,
          totalFiles: 'totalFilesFound' in result ? result.totalFilesFound : 0,
        });

        console.log(`Indexing job ${jobId} completed successfully`);
        
        return {
          success: true,
          message: result.message,
          filesProcessed: 'totalFilesProcessed' in result ? result.totalFilesProcessed : 0,
          vectorsAdded: 'totalVectorsAdded' in result ? result.totalVectorsAdded : 0,
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Indexing job ${jobId} failed:`, error);
        
        // Update job status to failed
        await updateIndexingProgress(jobId, {
          status: 'FAILED',
          errorMessage,
        });

        throw error; // Re-throw to mark BullMQ job as failed
      }
    },
    {
      ...WORKER_CONFIG,
      concurrency: 2, // Allow up to 2 concurrent indexing jobs
    }
  );
}

// Scheduled indexing job processor
export function createScheduledIndexingWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.SCHEDULED_INDEXING,
    async (job: Job<ScheduledIndexingJobData>) => {
      const { projectId, branch } = job.data;
      
      console.log(`Processing scheduled indexing for project ${projectId}`);
      
      try {
        // Get project details
        const project = await getProject(projectId);
        if (!project) {
          console.warn(`Scheduled indexing: Project ${projectId} not found`);
          return { success: false, message: 'Project not found' };
        }

        // Check if project has scheduled indexing enabled
        if (!project.scheduledIndexingEnabled) {
          console.log(`Scheduled indexing disabled for project ${project.name}`);
          return { success: false, message: 'Scheduled indexing disabled' };
        }

        // Check if project is not currently indexing
        if (project.indexStatus === 'INDEXING') {
          console.log(`Project ${project.name} is already indexing, skipping scheduled run`);
          return { success: false, message: 'Already indexing' };
        }

        // Run scheduled incremental indexing
        const result = await scheduledIncrementalIndexing(
          projectId,
          project.gitRepo,
          branch
        );

        console.log(`Scheduled indexing result for ${project.name}:`, result);

        return {
          success: result.success,
          message: result.message,
          action: result.action,
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Scheduled indexing failed for project ${projectId}:`, error);
        
        return {
          success: false,
          message: `Error: ${errorMessage}`,
        };
      }
    },
    WORKER_CONFIG
  );
}

// Cleanup job processor
export function createCleanupWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.CLEANUP,
    async (job: Job<{ type: string; targetId?: string }>) => {
      const { type, targetId } = job.data;
      
      console.log(`Processing cleanup job: ${type}`, targetId ? `for ${targetId}` : '');
      
      try {
        switch (type) {
          case 'expired_jobs':
            // Clean up old indexing jobs from database
            // This could be implemented to remove old completed/failed jobs
            console.log('Cleaning expired jobs...');
            break;
            
          case 'failed_vectors':
            // Clean up failed vector operations
            console.log('Cleaning failed vectors...');
            break;
            
          case 'project_cleanup':
            // Clean up resources for deleted project
            if (targetId) {
              console.log(`Cleaning up resources for project ${targetId}`);
            }
            break;
            
          default:
            console.warn(`Unknown cleanup type: ${type}`);
            return { success: false, message: 'Unknown cleanup type' };
        }

        return { success: true, message: `Cleanup ${type} completed` };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Cleanup job failed:`, error);
        throw error;
      }
    },
    WORKER_CONFIG
  );
}

// Worker management
let workers: Record<string, Worker> | null = null;

export function startWorkers(): Record<string, Worker> {
  if (workers) {
    console.log('Workers already started');
    return workers;
  }

  console.log('Starting BullMQ workers...');
  
  workers = {
    indexing: createIndexingWorker(),
    scheduledIndexing: createScheduledIndexingWorker(),
    cleanup: createCleanupWorker(),
  };

  // Set up error handling
  Object.entries(workers).forEach(([name, worker]) => {
    worker.on('completed', (job) => {
      console.log(`Worker ${name} completed job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Worker ${name} failed job ${job?.id}:`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`Worker ${name} error:`, err);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`Worker ${name} job ${jobId} stalled`);
    });
  });

  console.log('All workers started successfully');
  return workers;
}

export function stopWorkers(): Promise<void[]> {
  if (!workers) {
    return Promise.resolve([]);
  }

  console.log('Stopping BullMQ workers...');
  
  const shutdownPromises = Object.values(workers).map(worker => worker.close());
  workers = null;
  
  return Promise.all(shutdownPromises);
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down workers...');
  await stopWorkers();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);