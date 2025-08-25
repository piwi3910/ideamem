import { startWorkers } from './workers';

// Startup initialization
let workersStarted = false;

export async function initializeApp() {
  if (workersStarted) {
    console.log('Workers already started');
    return;
  }

  try {
    console.log('Starting BullMQ workers...');
    const workers = startWorkers();
    workersStarted = true;
    console.log('BullMQ workers started successfully:', Object.keys(workers));
  } catch (error) {
    console.error('Failed to start BullMQ workers:', error);
    // Don't throw - app should still work without background jobs
  }
}

// Auto-start workers when this module is imported
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_WORKERS === 'true') {
  // Delay startup to ensure Redis is available
  setTimeout(() => {
    initializeApp().catch(console.error);
  }, 2000);
}