import { PrismaClient } from './generated/prisma';
import { loggers, getLogLevel, LOG_LEVELS } from './logger';

// Global Prisma client instance to prevent multiple connections
declare global {
  var __prisma: PrismaClient | undefined;
}

class DatabaseClient {
  private static instance: PrismaClient;
  
  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      if (globalThis.__prisma) {
        DatabaseClient.instance = globalThis.__prisma;
      } else {
        DatabaseClient.instance = new PrismaClient({
          log: [
            {
              emit: 'event',
              level: 'query',
            },
            {
              emit: 'event', 
              level: 'error',
            },
            {
              emit: 'event',
              level: 'info',
            },
            {
              emit: 'event',
              level: 'warn',
            },
          ],
        });

        // Route Prisma logs to Winston (disabled for now)
        if (process.env.NODE_ENV === 'development') {
          (DatabaseClient.instance as any).$on('error', (e: any) => {
            loggers.database.error('Database Error', e, {
              target: e.target,
            });
          });

          (DatabaseClient.instance as any).$on('info', (e: any) => {
            loggers.database.info('Database Info', {
              message: e.message,
              target: e.target,
            });
          });

          (DatabaseClient.instance as any).$on('warn', (e: any) => {
            loggers.database.warn('Database Warning', {
              message: e.message,
              target: e.target,
            });
          });
        }
        
        // Store in global for hot reloading in development
        if (process.env.NODE_ENV !== 'production') {
          globalThis.__prisma = DatabaseClient.instance;
        }
      }
    }
    
    return DatabaseClient.instance;
  }
  
  public static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
      DatabaseClient.instance = null as any;
      globalThis.__prisma = undefined;
    }
  }
}

// Export singleton instance
export const prisma = DatabaseClient.getInstance();

// Initialize database with default config if it doesn't exist
export async function initializeDatabase() {
  try {
    // Check if config exists, create default if not
    const configExists = await prisma.config.findUnique({
      where: { id: 'default' },
    });

    if (!configExists) {
      await prisma.config.create({
        data: {
          id: 'default',
          qdrantUrl: 'http://localhost:6333',
          ollamaUrl: 'http://localhost:11434',
        },
      });
      loggers.database.info('Created default configuration');
    }
  } catch (error) {
    loggers.database.error('Failed to initialize database', error);
  }
}

// Graceful shutdown
export async function closeDatabase() {
  await DatabaseClient.disconnect();
}

// Export class for testing and advanced usage
export { DatabaseClient };

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await DatabaseClient.disconnect();
  });
  
  process.on('SIGINT', async () => {
    await DatabaseClient.disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await DatabaseClient.disconnect();
    process.exit(0);
  });
}
