import { startWorkers } from './workers';
import { initializeDocumentationScheduler } from './documentation-scheduler';

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
    
    // Initialize documentation scheduler after workers are started
    console.log('Initializing documentation scheduler...');
    await initializeDocumentationScheduler();
  } catch (error) {
    console.error('Failed to start BullMQ workers or documentation scheduler:', error);
    // Don't throw - app should still work without background jobs
  }
}

// Auto-start workers when this module is imported in any environment
// Delay startup to ensure Redis is available
setTimeout(() => {
  initializeApp().catch(console.error);
}, 3000); // Increased delay to ensure all services are ready