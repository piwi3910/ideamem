import { startWorkers } from './workers';
import { initializeDocumentationScheduler } from './documentation-scheduler';
import { loggers, loggerHealthCheck, initializeLoggerFromDatabase } from './logger';
import { initializeDatabase } from './database';

// Startup initialization
let workersStarted = false;

export async function initializeApp() {
  if (workersStarted) {
    loggers.startup.info('Workers already started');
    return;
  }

  try {
    // Initialize logging system
    loggers.startup.info('Initializing application startup...');
    
    if (!loggerHealthCheck()) {
      throw new Error('Logger health check failed');
    }

    // Initialize database first
    loggers.startup.info('Initializing database...');
    await initializeDatabase();
    
    // Initialize logger from database configuration
    loggers.startup.info('Initializing logger from database...');
    await initializeLoggerFromDatabase();
    
    // Start BullMQ workers
    loggers.startup.info('Starting BullMQ workers...');
    const workers = startWorkers();
    workersStarted = true;
    loggers.startup.info('BullMQ workers started successfully', {
      workers: Object.keys(workers),
    });
    
    // Initialize documentation scheduler after workers are started
    loggers.startup.info('Initializing documentation scheduler...');
    await initializeDocumentationScheduler();
    
    loggers.startup.info('Application startup completed successfully', {
      workersStarted: true,
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    loggers.startup.error('Application startup failed', error);
    // Don't throw - app should still work without background jobs
  }
}

// Auto-start workers when this module is imported in any environment
// Delay startup to ensure Redis is available
setTimeout(() => {
  initializeApp().catch(error => {
    loggers.startup.error('Auto-startup failed', error);
  });
}, 3000); // Increased delay to ensure all services are ready