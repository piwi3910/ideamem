import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RateLimitConfig } from './rate-limit';
import { withSecurityHeaders, SecurityHeadersConfig } from './security-headers';
import { withCompression, CompressionConfig } from './compression';
import { withCors, CorsConfig } from './cors';
import { withErrorHandling } from './error-handler';
import { withValidation, ValidationConfig } from './validation';

export type MiddlewareConfig = {
  cors?: CorsConfig | false;
  rateLimit?: RateLimitConfig | false;
  security?: SecurityHeadersConfig | false;
  compression?: CompressionConfig | false;
  validation?: ValidationConfig | false;
  errorHandling?: {
    context?: Record<string, any>;
  } | false;
};

type Handler = (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse;

/**
 * Compose multiple middleware functions into a single handler
 */
export function composeMiddleware(
  config: MiddlewareConfig,
  handler: Handler
): Handler {
  let composedHandler = handler;

  // Apply middleware in reverse order so they execute in the correct order
  // Order: CORS -> Rate Limit -> Security -> Compression -> Validation -> Error Handling -> Handler

  // Error handling (wraps the handler)
  if (config.errorHandling !== false) {
    composedHandler = withErrorHandling(
      composedHandler,
      config.errorHandling?.context || {}
    );
  }

  // Validation (before handler, after error handling)
  if (config.validation !== false && config.validation) {
    composedHandler = withValidation(config.validation, composedHandler as any) as Handler;
  }

  // Compression (after handler execution)
  if (config.compression !== false) {
    composedHandler = withCompression(composedHandler, config.compression);
  }

  // Security headers (after compression)
  if (config.security !== false) {
    composedHandler = withSecurityHeaders(composedHandler, config.security);
  }

  // Rate limiting (after CORS)
  if (config.rateLimit !== false && config.rateLimit) {
    composedHandler = withRateLimit(config.rateLimit, composedHandler);
  }

  // CORS (outermost layer - needs to handle OPTIONS)
  if (config.cors !== false) {
    composedHandler = withCors(composedHandler, config.cors);
  }

  return composedHandler;
}

/**
 * Pre-configured middleware stacks for common use cases
 */
export const MiddlewareStacks = {
  /**
   * Standard API endpoint middleware
   */
  api: (handler: Handler) =>
    composeMiddleware(
      {
        cors: {
          origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
          credentials: true,
        },
        rateLimit: {
          requests: 60,
          window: '1 m',
        },
        security: {
          contentSecurityPolicy: false,
          frameguard: { action: 'deny' },
        },
        compression: {
          threshold: 1024,
          level: 6,
        },
        errorHandling: {
          context: { type: 'api' },
        },
      },
      handler
    ),

  /**
   * Search endpoint middleware
   */
  search: (handler: Handler) =>
    composeMiddleware(
      {
        cors: {
          origin: '*',
          credentials: true,
        },
        rateLimit: {
          requests: 30,
          window: '1 m',
        },
        security: {
          contentSecurityPolicy: false,
        },
        compression: {
          threshold: 1024,
          level: 6,
        },
        errorHandling: {
          context: { type: 'search' },
        },
      },
      handler
    ),

  /**
   * Webhook endpoint middleware
   */
  webhook: (handler: Handler) =>
    composeMiddleware(
      {
        cors: {
          origin: (origin: string | undefined) => {
            const allowedPatterns = [
              /^https:\/\/github\.com$/,
              /^https:\/\/gitlab\.com$/,
              /^https:\/\/bitbucket\.org$/,
            ];
            return allowedPatterns.some((pattern) => pattern.test(origin || ''));
          },
          credentials: false,
        },
        rateLimit: {
          requests: 100,
          window: '1 m',
        },
        security: {
          contentSecurityPolicy: false,
          crossOriginResourcePolicy: { policy: 'cross-origin' },
        },
        compression: false, // Webhooks usually need raw responses
        errorHandling: {
          context: { type: 'webhook' },
        },
      },
      handler
    ),

  /**
   * Admin endpoint middleware
   */
  admin: (handler: Handler) =>
    composeMiddleware(
      {
        rateLimit: {
          requests: 100,
          window: '1 m',
        },
        security: {
          frameguard: { action: 'deny' },
          contentSecurityPolicy: {
            directives: {
              frameAncestors: ["'none'"],
            },
          },
        },
        compression: {
          threshold: 512,
          level: 6,
        },
        errorHandling: {
          context: { type: 'admin' },
        },
      },
      handler
    ),

  /**
   * Public API middleware (more permissive)
   */
  publicApi: (handler: Handler) =>
    composeMiddleware(
      {
        cors: {
          origin: '*',
          credentials: false,
        },
        rateLimit: {
          requests: 100,
          window: '1 m',
        },
        security: {
          contentSecurityPolicy: false,
          crossOriginResourcePolicy: { policy: 'cross-origin' },
          crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        },
        compression: {
          threshold: 1024,
          level: 6,
        },
        errorHandling: {
          context: { type: 'public-api' },
        },
      },
      handler
    ),

  /**
   * Health check endpoint (minimal overhead)
   */
  health: (handler: Handler) =>
    composeMiddleware(
      {
        rateLimit: false, // No rate limiting for health checks
        security: {
          contentSecurityPolicy: false,
          crossOriginResourcePolicy: { policy: 'cross-origin' },
        },
        compression: false, // Health checks should be fast
        errorHandling: {
          context: { type: 'health' },
        },
      },
      handler
    ),

  /**
   * Authentication endpoints
   */
  auth: (handler: Handler) =>
    composeMiddleware(
      {
        rateLimit: {
          requests: 5,
          window: '5 m',
        },
        security: {
          contentSecurityPolicy: false,
          frameguard: { action: 'deny' },
        },
        compression: false, // Auth responses are usually small
        errorHandling: {
          context: { type: 'auth' },
        },
      },
      handler
    ),
};