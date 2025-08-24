import { PrismaClient } from './generated/prisma';

// Global Prisma client instance to prevent multiple connections
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Initialize database with default config if it doesn't exist
export async function initializeDatabase() {
  try {
    // Check if config exists, create default if not
    const configExists = await prisma.config.findUnique({
      where: { id: 'default' }
    });

    if (!configExists) {
      await prisma.config.create({
        data: {
          id: 'default',
          qdrantUrl: 'http://localhost:6333',
          ollamaUrl: 'http://localhost:11434'
        }
      });
      console.log('✅ Created default configuration');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Graceful shutdown
export async function closeDatabase() {
  await prisma.$disconnect();
}