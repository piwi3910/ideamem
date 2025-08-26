import { prisma, initializeDatabase } from './database';

export interface AppConfig {
  qdrantUrl: string;
  ollamaUrl: string;
  // Logging configuration
  logLevel: string;
  // Documentation scheduling settings
  docReindexEnabled: boolean;
  docReindexInterval: number; // days
}

const defaultConfig: AppConfig = {
  qdrantUrl: 'http://localhost:6333',
  ollamaUrl: 'http://localhost:11434',
  logLevel: 'debug',
  docReindexEnabled: true,
  docReindexInterval: 14, // 14 days default
};

export async function getConfig(): Promise<AppConfig> {
  try {
    await initializeDatabase();

    const config = await prisma.config.findUnique({
      where: { id: 'default' },
    });

    if (config) {
      return {
        qdrantUrl: config.qdrantUrl,
        ollamaUrl: config.ollamaUrl,
        logLevel: config.logLevel,
        docReindexEnabled: config.docReindexEnabled,
        docReindexInterval: config.docReindexInterval,
      };
    } else {
      // Create default config if it doesn't exist
      const newConfig = await prisma.config.create({
        data: {
          id: 'default',
          qdrantUrl: defaultConfig.qdrantUrl,
          ollamaUrl: defaultConfig.ollamaUrl,
          logLevel: defaultConfig.logLevel,
          docReindexEnabled: defaultConfig.docReindexEnabled,
          docReindexInterval: defaultConfig.docReindexInterval,
        },
      });

      return {
        qdrantUrl: newConfig.qdrantUrl,
        ollamaUrl: newConfig.ollamaUrl,
        logLevel: newConfig.logLevel,
        docReindexEnabled: newConfig.docReindexEnabled,
        docReindexInterval: newConfig.docReindexInterval,
      };
    }
  } catch (error) {
    console.error('Failed to get config from database:', error);
    // Fallback to default config
    return defaultConfig;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await initializeDatabase();

    await prisma.config.upsert({
      where: { id: 'default' },
      update: {
        qdrantUrl: config.qdrantUrl,
        ollamaUrl: config.ollamaUrl,
        logLevel: config.logLevel,
        docReindexEnabled: config.docReindexEnabled,
        docReindexInterval: config.docReindexInterval,
      },
      create: {
        id: 'default',
        qdrantUrl: config.qdrantUrl,
        ollamaUrl: config.ollamaUrl,
        logLevel: config.logLevel,
        docReindexEnabled: config.docReindexEnabled,
        docReindexInterval: config.docReindexInterval,
      },
    });
  } catch (error) {
    console.error('Failed to save config to database:', error);
    throw new Error('Could not save configuration to database.');
  }
}

export async function getLogLevel(): Promise<string> {
  try {
    await initializeDatabase();
    const config = await prisma.config.findUnique({
      where: { id: 'default' },
      select: { logLevel: true },
    });
    return config?.logLevel || 'debug';
  } catch (error) {
    console.error('Failed to get log level from database:', error);
    return 'debug';
  }
}

export async function saveLogLevel(level: string): Promise<void> {
  try {
    await initializeDatabase();
    await prisma.config.upsert({
      where: { id: 'default' },
      update: { logLevel: level },
      create: {
        id: 'default',
        qdrantUrl: 'http://localhost:6333',
        ollamaUrl: 'http://localhost:11434',
        logLevel: level,
        docReindexEnabled: true,
        docReindexInterval: 14,
      },
    });
  } catch (error) {
    console.error('Failed to save log level to database:', error);
    console.error('Database error details:', error);
    throw new Error(`Could not save log level to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
