import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';

// Redis client singleton
let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('Connecting to Redis:', redisUrl.replace(/:([^@]*@)/, ':****@')); // Hide password in logs

    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      console.log('Redis Client Ready');
    });

    await redisClient.connect();
  }

  return redisClient;
}

// Search Results Cache
export interface SearchCacheEntry {
  queryHash: string;
  results: any[];
  metadata: {
    totalResults: number;
    searchTime: number;
    timestamp: number;
  };
}

export class SearchResultsCache {
  private static readonly CACHE_PREFIX = 'search:';
  private static readonly DEFAULT_TTL = 60 * 60; // 1 hour in seconds

  static generateQueryHash(query: string, filters: Record<string, any> = {}): string {
    const queryObject = {
      query: query.toLowerCase().trim(),
      filters: Object.keys(filters)
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = filters[key];
            return acc;
          },
          {} as Record<string, any>
        ),
    };

    return createHash('sha256').update(JSON.stringify(queryObject)).digest('hex').substring(0, 16); // Use first 16 chars for shorter keys
  }

  static async get(queryHash: string): Promise<SearchCacheEntry | null> {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(`${this.CACHE_PREFIX}${queryHash}`);

      if (!cached || typeof cached !== 'string') {
        return null;
      }

      const entry: SearchCacheEntry = JSON.parse(cached);

      // Check if entry is still fresh (within reasonable time bounds)
      const age = Date.now() - entry.metadata.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        // Entry is too old, remove it
        await this.delete(queryHash);
        return null;
      }

      return entry;
    } catch (error) {
      console.warn(
        'Redis cache unavailable, proceeding without cache:',
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  static async set(
    queryHash: string,
    results: any[],
    metadata: { totalResults: number; searchTime: number },
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const entry: SearchCacheEntry = {
        queryHash,
        results,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
        },
      };

      await redis.setEx(`${this.CACHE_PREFIX}${queryHash}`, ttl, JSON.stringify(entry));
    } catch (error) {
      console.warn(
        'Redis cache unavailable, skipping cache write:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  static async delete(queryHash: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${queryHash}`);
    } catch (error) {
      console.warn(
        'Redis cache unavailable, skipping cache delete:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  static async clear(): Promise<void> {
    try {
      const redis = await getRedisClient();
      const keys = await redis.keys(`${this.CACHE_PREFIX}*`);

      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.warn(
        'Redis cache unavailable, skipping cache clear:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// Parsed Content Cache
export interface ContentCacheEntry {
  urlHash: string;
  rawContent: string;
  parsedContent: string;
  metadata: {
    contentType: string;
    language: string;
    wordCount: number;
    extractionMethod: string;
    lastModified?: string;
    timestamp: number;
    renderingEngine?: string;
    requiresDynamicRendering?: boolean;
  };
}

export class ParsedContentCache {
  private static readonly CACHE_PREFIX = 'content:';
  private static readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  static generateUrlHash(url: string, lastModified?: string): string {
    const hashInput = `${url}:${lastModified || 'no-lastmod'}`;
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  static async get(urlHash: string): Promise<ContentCacheEntry | null> {
    try {
      const redis = await getRedisClient();
      const cached = await redis.get(`${this.CACHE_PREFIX}${urlHash}`);

      if (!cached || typeof cached !== 'string') {
        return null;
      }

      const entry: ContentCacheEntry = JSON.parse(cached);

      // Check if entry is still fresh
      const age = Date.now() - entry.metadata.timestamp;
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      if (age > maxAge) {
        await this.delete(urlHash);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Error getting content cache:', error);
      return null;
    }
  }

  static async set(
    urlHash: string,
    rawContent: string,
    parsedContent: string,
    metadata: {
      contentType: string;
      language: string;
      wordCount: number;
      extractionMethod: string;
      lastModified?: string;
      renderingEngine?: string;
      requiresDynamicRendering?: boolean;
    },
    ttl: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const redis = await getRedisClient();
      const entry: ContentCacheEntry = {
        urlHash,
        rawContent,
        parsedContent,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
        },
      };

      await redis.setEx(`${this.CACHE_PREFIX}${urlHash}`, ttl, JSON.stringify(entry));
    } catch (error) {
      console.error('Error setting content cache:', error);
    }
  }

  static async delete(urlHash: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${urlHash}`);
    } catch (error) {
      console.error('Error deleting content cache:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      const redis = await getRedisClient();
      const keys = await redis.keys(`${this.CACHE_PREFIX}*`);

      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Error clearing content cache:', error);
    }
  }

  // Helper method to check if content has been modified
  static async isContentModified(url: string, currentLastModified?: string): Promise<boolean> {
    const urlHash = this.generateUrlHash(url, currentLastModified);
    const cached = await this.get(urlHash);

    if (!cached) {
      return true; // No cache means we should fetch
    }

    // If last modified headers don't match, content has changed
    if (cached.metadata.lastModified !== currentLastModified) {
      return true;
    }

    // Check age-based expiration
    const age = Date.now() - cached.metadata.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    return age > maxAge;
  }
}

// Cache health monitoring
export class CacheHealth {
  static async getStats(): Promise<{
    connected: boolean;
    searchCacheSize: number;
    contentCacheSize: number;
    memoryUsage?: string;
  }> {
    try {
      const redis = await getRedisClient();

      const [searchKeys, contentKeys, info] = await Promise.all([
        redis.keys('search:*'),
        redis.keys('content:*'),
        redis.info('memory').catch(() => null),
      ]);

      let memoryUsage: string | undefined;
      if (info) {
        const match = info.match(/used_memory_human:([^\r\n]+)/);
        memoryUsage = match ? match[1].trim() : undefined;
      }

      return {
        connected: true,
        searchCacheSize: searchKeys.length,
        contentCacheSize: contentKeys.length,
        memoryUsage,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        connected: false,
        searchCacheSize: 0,
        contentCacheSize: 0,
      };
    }
  }

  static async clearAll(): Promise<void> {
    await Promise.all([SearchResultsCache.clear(), ParsedContentCache.clear()]);
  }
}

// Cleanup function for graceful shutdown
export async function closeCacheConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}
