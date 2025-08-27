import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

// In-memory store for development/testing
class InMemoryStore {
  private store: Map<string, { count: number; resetAt: number }> = new Map();

  async get(key: string): Promise<number | null> {
    const data = this.store.get(key);
    if (!data) return null;
    
    if (Date.now() > data.resetAt) {
      this.store.delete(key);
      return null;
    }
    
    return data.count;
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      count: value,
      resetAt: Date.now() + (ttl * 1000),
    });
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key) || 0;
    const newValue = current + 1;
    await this.set(key, newValue, 60); // 1 minute TTL
    return newValue;
  }
}

// Rate limit configurations
export const RateLimitConfigs = {
  // API rate limits
  api: {
    default: { requests: 60, window: '1 m' },
    search: { requests: 30, window: '1 m' },
    indexing: { requests: 5, window: '1 m' },
    webhook: { requests: 100, window: '1 m' },
  },
  // Authentication rate limits
  auth: {
    login: { requests: 5, window: '5 m' },
    register: { requests: 3, window: '5 m' },
    token: { requests: 10, window: '1 h' },
  },
  // Admin rate limits (more permissive)
  admin: {
    default: { requests: 100, window: '1 m' },
  },
} as const;

// Initialize rate limiter based on environment
const createRateLimiter = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Production: Use Upstash Redis
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    return {
      create: (config: { requests: number; window: string }) =>
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.requests, config.window),
          analytics: true,
          prefix: '@ideamem/ratelimit',
        }),
    };
  } else {
    // Development: Use in-memory store with basic rate limiting
    console.warn('Rate limiting using in-memory store (development mode)');
    const store = new InMemoryStore();
    
    return {
      create: (config: { requests: number; window: string }) => ({
        limit: async (identifier: string) => {
          const key = `ratelimit:${identifier}`;
          const count = await store.incr(key);
          const success = count <= config.requests;
          
          return {
            success,
            limit: config.requests,
            remaining: Math.max(0, config.requests - count),
            reset: Date.now() + 60000, // Reset in 1 minute
            pending: Promise.resolve(),
          };
        },
      }),
    };
  }
};

const rateLimiterFactory = createRateLimiter();

export type RateLimitConfig = {
  requests: number;
  window: string;
  identifier?: (request: NextRequest) => string;
  skipIf?: (request: NextRequest) => boolean;
};

/**
 * Rate limiting middleware
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Skip rate limiting if condition is met
    if (config.skipIf?.(request)) {
      return handler(request, context);
    }

    // Get identifier (default to IP address)
    const identifier = config.identifier
      ? config.identifier(request)
      : request.ip || request.headers.get('x-forwarded-for') || 'anonymous';

    // Create rate limiter
    const rateLimiter = rateLimiterFactory.create({
      requests: config.requests,
      window: config.window,
    });

    // Check rate limit
    const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

    // Add rate limit headers
    const response = success
      ? await handler(request, context)
      : createErrorResponse(
          'Too many requests. Please try again later.',
          HTTP_STATUS.TOO_MANY_REQUESTS,
          { retryAfter: Math.ceil((reset - Date.now()) / 1000) }
        );

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());

    return response;
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  /**
   * Default API rate limiting
   */
  api: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withRateLimit(
      {
        ...RateLimitConfigs.api.default,
        identifier: (req) => {
          // Use API key if present, otherwise IP
          const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
          return apiKey || req.ip || 'anonymous';
        },
      },
      handler
    ),

  /**
   * Search endpoint rate limiting
   */
  search: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withRateLimit(
      {
        ...RateLimitConfigs.api.search,
        identifier: (req) => {
          const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
          return apiKey || req.ip || 'anonymous';
        },
      },
      handler
    ),

  /**
   * Indexing operations rate limiting
   */
  indexing: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withRateLimit(RateLimitConfigs.api.indexing, handler),

  /**
   * Webhook rate limiting (more permissive)
   */
  webhook: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withRateLimit(
      {
        ...RateLimitConfigs.api.webhook,
        identifier: (req) => {
          // Use project ID from params if available
          const url = new URL(req.url);
          const projectId = url.pathname.split('/').pop();
          return projectId || req.ip || 'anonymous';
        },
      },
      handler
    ),

  /**
   * Admin operations rate limiting
   */
  admin: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withRateLimit(
      {
        ...RateLimitConfigs.admin.default,
        skipIf: (req) => {
          // Skip for internal requests
          return req.headers.get('x-internal-request') === 'true';
        },
      },
      handler
    ),

  /**
   * Authentication rate limiting
   */
  auth: {
    login: (
      handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
    ) =>
      withRateLimit(
        {
          ...RateLimitConfigs.auth.login,
          identifier: (req) => {
            // Use email if in body, otherwise IP
            return req.ip || 'anonymous';
          },
        },
        handler
      ),

    token: (
      handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
    ) =>
      withRateLimit(RateLimitConfigs.auth.token, handler),
  },
};

/**
 * Combine rate limiting with other middleware
 */
export function withRateLimitAndError(
  rateLimitConfig: RateLimitConfig,
  errorContext?: any,
  handler?: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
) {
  if (!handler) {
    // Return a function that takes the handler (for decorator pattern)
    return (h: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse) =>
      withRateLimitAndError(rateLimitConfig, errorContext, h);
  }

  // Apply both rate limiting and error handling
  const withError = require('./error-handler').withErrorHandling;
  return withRateLimit(rateLimitConfig, withError(handler, errorContext));
}