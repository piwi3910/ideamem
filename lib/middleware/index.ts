/**
 * Unified Middleware Export
 * 
 * Central export point for all middleware components
 */

// Authentication middleware
export { 
  withAuth, 
  withOptionalAuth, 
  withProjectAuth,
  AuthPatterns,
  type AuthContext,
  type AuthenticatedRouteHandler,
  type OptionalAuthRouteHandler 
} from './auth';

// Error handling middleware
export { 
  withErrorHandling,
  ErrorHandlers,
  createPreferenceErrorHandler,
  createRuleErrorHandler,
  type RouteHandler,
  type ErrorContext 
} from './error-handler';

// Logging middleware
export { 
  withLogging,
  withTiming,
  LoggingMiddleware,
  PerformanceLogger,
  Logger,
  type LogContext,
  type LoggingOptions 
} from './logging';

// Parameter handling middleware
export { 
  withParams,
  ParamMiddleware,
  ParamPatterns,
  ParamSchemas,
  extractParams,
  getParam,
  getUuidParam,
  getProjectId,
  type RouteParams,
  type ParamHandler 
} from './params';

// Validation middleware
export { 
  withValidation,
  ValidationMiddleware,
  ValidationPatterns,
  CommonSchemas,
  createValidationMiddleware,
  type ValidationSchemas,
  type ValidatedRequest,
  type ValidatedRouteHandler 
} from './validation';

// Rate limiting middleware
export { 
  withRateLimit,
  RateLimiters,
  RateLimitConfigs,
  type RateLimitConfig
} from './rate-limit';

// Security headers middleware
export { 
  withSecurityHeaders,
  SecurityHeaders,
  defaultSecurityConfig,
  developmentSecurityConfig,
  type SecurityHeadersConfig
} from './security-headers';

// Compression middleware
export { 
  withCompression,
  Compression,
  defaultCompressionConfig,
  type CompressionConfig
} from './compression';

// CORS middleware
export { 
  withCors,
  Cors,
  defaultCorsConfig,
  developmentCorsConfig,
  type CorsConfig
} from './cors';

// Combined middleware utilities
export { 
  withMiddleware,
  type CombinedConfig,
  type CombinedHandler
} from './combined';

// Middleware composition
export { 
  composeMiddleware,
  MiddlewareStacks,
  type MiddlewareConfig
} from './compose';

/**
 * Common middleware composition patterns
 * 
 * Note: Use individual middleware imports for proper type safety
 * Example:
 * 
 * import { withAuth } from '@/lib/middleware/auth';
 * import { withLogging } from '@/lib/middleware/logging';
 * import { withErrorHandling } from '@/lib/middleware/error-handler';
 * 
 * export const POST = withAuth(
 *   withLogging(
 *     withErrorHandling(handler, { resource: 'user', operation: 'create' }),
 *     { service: 'ideamem-api' }
 *   )
 * );
 */