import { getOllamaClient } from '@/lib/config';
import { getQdrantClient, testQdrantConnection } from '@/lib/memory';
import { prisma } from '@/lib/database';

export type ServiceStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface ServiceHealth {
  status: ServiceStatus;
  message?: string;
  latency?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: ServiceStatus;
  timestamp: string;
  services: {
    database: ServiceHealth;
    vectorDb: ServiceHealth;
    ollama: ServiceHealth;
    embedding: ServiceHealth;
  };
  system?: {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    nodeVersion: string;
  };
}

/**
 * Health check service for monitoring system components
 */
export class HealthCheckService {
  private static instance: HealthCheckService;

  private constructor() {}

  static getInstance(): HealthCheckService {
    if (!this.instance) {
      this.instance = new HealthCheckService();
    }
    return this.instance;
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // Simple query to test connection
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'healthy',
        latency: Date.now() - start,
        message: 'Database connection successful',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Qdrant vector database health
   */
  async checkQdrant(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const isHealthy = await testQdrantConnection();
      
      if (isHealthy) {
        // Get additional metrics
        const client = getQdrantClient();
        const collections = await client.getCollections();
        
        return {
          status: 'healthy',
          latency: Date.now() - start,
          message: 'Qdrant connection successful',
          details: {
            collections: collections.collections.length,
          },
        };
      }
      
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: 'Qdrant connection failed',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Qdrant health check failed',
      };
    }
  }

  /**
   * Check Ollama service health
   */
  async checkOllama(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const client = getOllamaClient();
      const response = await fetch(`${client.baseUrl}/api/tags`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          latency: Date.now() - start,
          message: 'Ollama service is running',
          details: {
            models: data.models?.length || 0,
          },
        };
      }
      
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: `Ollama returned status ${response.status}`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Ollama connection failed',
      };
    }
  }

  /**
   * Check embedding model availability
   */
  async checkEmbeddingModel(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const client = getOllamaClient();
      const response = await fetch(`${client.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'nomic-embed-text' }),
      });
      
      if (response.ok) {
        return {
          status: 'healthy',
          latency: Date.now() - start,
          message: 'Embedding model available',
        };
      }
      
      if (response.status === 404) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: 'Embedding model not found. Run: ollama pull nomic-embed-text',
        };
      }
      
      return {
        status: 'degraded',
        latency: Date.now() - start,
        message: `Embedding model check returned status ${response.status}`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Embedding model check failed',
      };
    }
  }

  /**
   * Perform a specific health check
   */
  async checkService(service: 'database' | 'qdrant' | 'ollama' | 'embedding'): Promise<ServiceHealth> {
    switch (service) {
      case 'database':
        return this.checkDatabase();
      case 'qdrant':
        return this.checkQdrant();
      case 'ollama':
        return this.checkOllama();
      case 'embedding':
        return this.checkEmbeddingModel();
      default:
        return {
          status: 'unhealthy',
          message: `Unknown service: ${service}`,
        };
    }
  }

  /**
   * Perform a complete system health check
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const [database, vectorDb, ollama, embedding] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkQdrant(),
      this.checkOllama(),
      this.checkEmbeddingModel(),
    ]);

    const getResult = (result: PromiseSettledResult<ServiceHealth>): ServiceHealth => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        status: 'unhealthy',
        message: result.reason?.message || 'Health check failed',
      };
    };

    const services = {
      database: getResult(database),
      vectorDb: getResult(vectorDb),
      ollama: getResult(ollama),
      embedding: getResult(embedding),
    };

    // Determine overall system status
    const statuses = Object.values(services).map(s => s.status);
    let overallStatus: ServiceStatus = 'healthy';
    
    if (statuses.every(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
      },
    };
  }

  /**
   * Get readiness status (for k8s readiness probes)
   */
  async isReady(): Promise<boolean> {
    const health = await this.checkSystemHealth();
    return health.status !== 'unhealthy';
  }

  /**
   * Get liveness status (for k8s liveness probes)
   */
  async isAlive(): Promise<boolean> {
    try {
      // Just check if the process can respond
      await this.checkDatabase();
      return true;
    } catch {
      return false;
    }
  }
}