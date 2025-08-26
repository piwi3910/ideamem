import { loggers } from './logger';

type ShutdownHandler = {
  name: string;
  handler: () => Promise<void> | void;
  priority: number; // Lower numbers run first
};

/**
 * Centralized shutdown manager to prevent EventEmitter memory leaks
 * Manages all process signal handlers in a single place
 */
class ShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private initialized = false;

  /**
   * Register a shutdown handler
   */
  register(name: string, handler: () => Promise<void> | void, priority: number = 10): void {
    this.handlers.push({ name, handler, priority });
    this.handlers.sort((a, b) => a.priority - b.priority);
    
    loggers.startup.debug('Shutdown handler registered', { 
      name, 
      priority,
      totalHandlers: this.handlers.length 
    });

    // Initialize signal handlers on first registration
    if (!this.initialized) {
      this.initializeSignalHandlers();
    }
  }

  /**
   * Initialize process signal handlers (only once)
   */
  private initializeSignalHandlers(): void {
    if (this.initialized) return;

    // Increase max listeners to handle our controlled shutdown handlers
    process.setMaxListeners(20);

    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('beforeExit', this.gracefulShutdown.bind(this));

    this.initialized = true;
    loggers.startup.info('Shutdown manager initialized', {
      maxListeners: process.getMaxListeners()
    });
  }

  /**
   * Execute all shutdown handlers in priority order
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    loggers.startup.info('Graceful shutdown initiated', {
      handlersCount: this.handlers.length
    });

    const startTime = Date.now();

    for (const { name, handler, priority } of this.handlers) {
      try {
        loggers.startup.debug('Executing shutdown handler', { name, priority });
        const handlerStart = Date.now();
        
        await Promise.resolve(handler());
        
        const duration = Date.now() - handlerStart;
        loggers.startup.debug('Shutdown handler completed', { 
          name, 
          priority, 
          duration: `${duration}ms` 
        });
      } catch (error) {
        loggers.startup.error('Shutdown handler failed', error, { 
          name, 
          priority 
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    loggers.startup.info('Graceful shutdown completed', {
      duration: `${totalDuration}ms`,
      handlersExecuted: this.handlers.length
    });

    // Exit the process
    process.exit(0);
  }

  /**
   * Get current shutdown handlers (for debugging)
   */
  getHandlers(): Array<{ name: string; priority: number }> {
    return this.handlers.map(({ name, priority }) => ({ name, priority }));
  }
}

// Export singleton instance
export const shutdownManager = new ShutdownManager();

/**
 * Convenience function to register shutdown handlers
 */
export function registerShutdownHandler(
  name: string, 
  handler: () => Promise<void> | void, 
  priority: number = 10
): void {
  shutdownManager.register(name, handler, priority);
}

/**
 * Get list of registered shutdown handlers
 */
export function getShutdownHandlers(): Array<{ name: string; priority: number }> {
  return shutdownManager.getHandlers();
}