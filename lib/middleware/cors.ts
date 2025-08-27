import { NextRequest, NextResponse } from 'next/server';

export type CorsConfig = {
  origin?: string | string[] | ((origin: string | undefined) => boolean | string);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
};

/**
 * Default CORS configuration
 */
export const defaultCorsConfig: CorsConfig = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

/**
 * Development CORS configuration (more permissive)
 */
export const developmentCorsConfig: CorsConfig = {
  origin: true, // Allow any origin in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['*'], // Allow all headers
  exposedHeaders: ['*'], // Expose all headers
  credentials: true,
  maxAge: 3600, // 1 hour
  optionsSuccessStatus: 204,
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(
  origin: string | undefined,
  allowedOrigin: CorsConfig['origin']
): string | false {
  if (!origin) return false;

  // Allow all origins
  if (allowedOrigin === '*' || allowedOrigin === true) {
    return origin;
  }

  // Check specific origin
  if (typeof allowedOrigin === 'string') {
    return origin === allowedOrigin ? origin : false;
  }

  // Check array of origins
  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin) ? origin : false;
  }

  // Check function
  if (typeof allowedOrigin === 'function') {
    const result = allowedOrigin(origin);
    return result === true ? origin : typeof result === 'string' ? result : false;
  }

  return false;
}

/**
 * Apply CORS headers to response
 */
function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
  config: CorsConfig
): NextResponse {
  const origin = request.headers.get('origin') || undefined;
  const allowedOrigin = isOriginAllowed(origin, config.origin);

  // Set origin header
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  } else if (config.origin === '*') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  // Set credentials header
  if (config.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Set methods header
  if (config.methods && config.methods.length > 0) {
    response.headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
  }

  // Set allowed headers
  if (config.allowedHeaders && config.allowedHeaders.length > 0) {
    response.headers.set(
      'Access-Control-Allow-Headers',
      Array.isArray(config.allowedHeaders)
        ? config.allowedHeaders.join(', ')
        : config.allowedHeaders
    );
  }

  // Set exposed headers
  if (config.exposedHeaders && config.exposedHeaders.length > 0) {
    response.headers.set(
      'Access-Control-Expose-Headers',
      Array.isArray(config.exposedHeaders)
        ? config.exposedHeaders.join(', ')
        : config.exposedHeaders
    );
  }

  // Set max age header
  if (config.maxAge) {
    response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
  }

  // Add Vary header
  if (config.origin !== '*') {
    const vary = response.headers.get('Vary');
    if (vary) {
      response.headers.set('Vary', `${vary}, Origin`);
    } else {
      response.headers.set('Vary', 'Origin');
    }
  }

  return response;
}

/**
 * CORS middleware for Next.js API routes
 */
export function withCors(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse,
  config?: CorsConfig
) {
  const corsConfig =
    process.env.NODE_ENV === 'production'
      ? { ...defaultCorsConfig, ...config }
      : { ...developmentCorsConfig, ...config };

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, {
        status: corsConfig.optionsSuccessStatus || 204,
      });
      return applyCorsHeaders(request, response, corsConfig);
    }

    // Handle actual requests
    const response = await handler(request, context);
    return applyCorsHeaders(request, response, corsConfig);
  };
}

/**
 * Pre-configured CORS for different use cases
 */
export const Cors = {
  /**
   * Default CORS for API routes
   */
  api: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCors(handler, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    }),

  /**
   * Public API CORS (allow all origins)
   */
  publicApi: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCors(handler, {
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST'],
    }),

  /**
   * Webhook CORS (allow specific services)
   */
  webhook: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCors(handler, {
      origin: (origin) => {
        // Allow GitHub, GitLab, Bitbucket webhooks
        const allowedPatterns = [
          /^https:\/\/github\.com$/,
          /^https:\/\/gitlab\.com$/,
          /^https:\/\/bitbucket\.org$/,
          /^https:\/\/api\.github\.com$/,
        ];
        return allowedPatterns.some((pattern) => pattern.test(origin || ''));
      },
      credentials: false,
    }),

  /**
   * Admin CORS (restrictive)
   */
  admin: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse
  ) =>
    withCors(handler, {
      origin: process.env.ADMIN_ORIGINS?.split(',') || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    }),
};