import { QueueManager } from './queue';
import { getConfig } from './config';
import { getActiveDocumentationRepositories } from './documentation-repositories';

// Global documentation scheduler state
let schedulerInitialized = false;
let currentScheduledJobId: string | null = null;

/**
 * Initialize the documentation scheduler based on current config
 */
export async function initializeDocumentationScheduler(): Promise<void> {
  if (schedulerInitialized) {
    console.log('Documentation scheduler already initialized');
    return;
  }

  try {
    console.log('Initializing documentation scheduler...');
    
    const config = await getConfig();
    
    if (config.docReindexEnabled) {
      await startDocumentationScheduling(config.docReindexInterval);
      console.log(`Documentation scheduler started with ${config.docReindexInterval} minute interval`);
    } else {
      console.log('Documentation scheduling is disabled');
    }
    
    schedulerInitialized = true;
  } catch (error) {
    console.error('Failed to initialize documentation scheduler:', error);
    throw error;
  }
}

/**
 * Start scheduled documentation indexing
 */
export async function startDocumentationScheduling(intervalDays: number): Promise<void> {
  try {
    // Stop existing scheduled job if any
    await stopDocumentationScheduling();
    
    // Check if there are any active repositories before starting scheduler
    const activeRepos = await getActiveDocumentationRepositories();
    if (activeRepos.length === 0) {
      console.log('No active documentation repositories found, scheduler will start but no work will be queued');
    }
    
    // Start new scheduled job
    const job = await QueueManager.addScheduledDocumentationIndexingJob(intervalDays);
    currentScheduledJobId = job.id || null;
    
    console.log(`Documentation scheduling started with ${intervalDays} day interval`);
  } catch (error) {
    console.error('Failed to start documentation scheduling:', error);
    throw error;
  }
}

/**
 * Stop scheduled documentation indexing
 */
export async function stopDocumentationScheduling(): Promise<void> {
  try {
    if (currentScheduledJobId) {
      await QueueManager.removeScheduledDocumentationIndexingJob();
      currentScheduledJobId = null;
      console.log('Documentation scheduling stopped');
    }
  } catch (error) {
    console.error('Failed to stop documentation scheduling:', error);
    throw error;
  }
}

/**
 * Update documentation scheduling settings
 */
export async function updateDocumentationScheduling(enabled: boolean, intervalDays: number): Promise<void> {
  try {
    if (enabled) {
      await startDocumentationScheduling(intervalDays);
    } else {
      await stopDocumentationScheduling();
    }
  } catch (error) {
    console.error('Failed to update documentation scheduling:', error);
    throw error;
  }
}

/**
 * Get current documentation scheduler status
 */
export async function getDocumentationSchedulerStatus(): Promise<{
  enabled: boolean;
  interval: number;
  activeRepositories: number;
  scheduledJobId: string | null;
}> {
  try {
    const config = await getConfig();
    const activeRepos = await getActiveDocumentationRepositories();
    
    return {
      enabled: config.docReindexEnabled,
      interval: config.docReindexInterval,
      activeRepositories: activeRepos.length,
      scheduledJobId: currentScheduledJobId,
    };
  } catch (error) {
    console.error('Failed to get documentation scheduler status:', error);
    return {
      enabled: false,
      interval: 14,
      activeRepositories: 0,
      scheduledJobId: null,
    };
  }
}

/**
 * Trigger immediate documentation indexing check (bypassing schedule)
 */
export async function triggerImmediateDocumentationIndexing(): Promise<void> {
  try {
    console.log('Triggering immediate documentation indexing check...');
    
    // Queue a one-time check job
    await QueueManager.addDocumentationIndexingJob({
      repositoryId: 'check-all',
      repositoryUrl: '',
      branch: '',
      sourceType: 'git',
      forceReindex: false,
    });
    
    console.log('Immediate documentation indexing check queued');
  } catch (error) {
    console.error('Failed to trigger immediate documentation indexing:', error);
    throw error;
  }
}

// Scheduler is initialized from startup.ts to ensure proper sequencing