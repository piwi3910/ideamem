import { NextRequest, NextResponse } from 'next/server';
import { Logger, createRequestLogger, loggers } from '@/lib/logger';

export type LogLevel = 'debug' | 'info' | 'http' | 'warn' | 'error';

export type RequestLog = {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  userAgent?: string;
  ip?: string;
  duration?: number;
  statusCode?: number;
  projectId?: string;
  userId?: string;
  requestId: string;
};

export type LogContext = {
  requestId?: string;
  projectId?: string;
  userId?: string;
  operation?: string;
  resource?: string;
  service?: string;
};

export type LoggingOptions = {
  logLevel?: LogLevel;
  logHeaders?: boolean;
  logBody?: boolean;
  excludeHeaders?: string[];
  includeHeaders?: string[];
  maxBodySize?: number;
  enablePerformanceLogging?: boolean;
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return realIP || 'unknown';
}

/**
 * Filter headers based on options
 */
function filterHeaders(
  headers: Headers,
  options: LoggingOptions
): Record<string, string> {
  const filteredHeaders: Record<string, string> = {};
  
  if (!options.logHeaders) {
    return filteredHeaders;
  }
  
  const excludeHeaders = new Set([
    'authorization',
    'cookie',
    'x-api-key',
    ...(options.excludeHeaders || [])
  ]);
  
  const includeHeaders = options.includeHeaders;
  
  for (const [key, value] of Array.from(headers.entries())) {
    const lowerKey = key.toLowerCase();
    
    // Skip excluded headers
    if (excludeHeaders.has(lowerKey)) {
      continue;
    }
    
    // If include list is specified, only include those headers
    if (includeHeaders && !includeHeaders.includes(lowerKey)) {
      continue;
    }
    
    filteredHeaders[lowerKey] = value;
  }
  
  return filteredHeaders;
}

/**
 * Log request information
 */
function logRequest(
  request: NextRequest,
  context: LogContext,
  options: LoggingOptions
): RequestLog {
  const requestLog: RequestLog = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    headers: filterHeaders(request.headers, options),
    userAgent: request.headers.get('user-agent') || undefined,
    ip: getClientIP(request),
    requestId: context.requestId || generateRequestId(),
    projectId: context.projectId,
    userId: context.userId,
  };
  
  // Use Winston with service context
  const serviceName = context.service || 'ideamem-api';
  const requestLogger = createRequestLogger(requestLog.requestId, serviceName);
  
  requestLogger.http('Incoming API Request', {
    method: request.method,
    url: request.url,
    userAgent: requestLog.userAgent,
    ip: requestLog.ip,
    projectId: context.projectId,
    userId: context.userId,
    operation: context.operation,
    resource: context.resource,
    headers: requestLog.headers,
    type: 'request_start',
  });
  
  return requestLog;
}

/**
 * Log response information
 */
function logResponse(
  requestLog: RequestLog,
  response: NextResponse,
  duration: number,
  context: LogContext,
  options: LoggingOptions
) {
  const serviceName = context.service || 'ideamem-api';
  const requestLogger = createRequestLogger(requestLog.requestId, serviceName);
  
  const responseData = {
    method: requestLog.method,
    url: requestLog.url,
    statusCode: response.status,
    duration,
    projectId: context.projectId,
    userId: context.userId,
    operation: context.operation,
    resource: context.resource,
    type: 'request_complete',
  };
  
  // Log based on status code
  if (response.status >= 500) {
    requestLogger.error('API Request Failed (Server Error)', responseData);
  } else if (response.status >= 400) {
    requestLogger.warn('API Request Failed (Client Error)', responseData);
  } else {
    requestLogger.http('API Request Completed', responseData);
  }
  
  // Log performance metrics if enabled
  if (options.enablePerformanceLogging && duration > 1000) {
    Logger.perf(`Slow API Response: ${requestLog.method} ${requestLog.url}`, duration, {
      requestId: requestLog.requestId,
      url: requestLog.url,
      method: requestLog.method,
      statusCode: response.status,
    }, serviceName);
  }
}

/**
 * Middleware wrapper that provides comprehensive logging
 */
export function withLogging(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  context: LogContext = {},
  options: LoggingOptions = {}
) {
  const defaultOptions: LoggingOptions = {
    logLevel: 'info',
    logHeaders: true,
    logBody: false,
    excludeHeaders: ['authorization', 'cookie'],
    maxBodySize: 10000,
    enablePerformanceLogging: true,
    ...options,
  };

  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Enhance context with request ID
    const enhancedContext = {
      ...context,
      requestId,
    };
    
    // Log incoming request
    const requestLog = logRequest(request, enhancedContext, defaultOptions);
    
    try {
      // Add request ID to headers for downstream services
      const requestWithId = new NextRequest(request, {
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'x-request-id': requestId,
        },
      });
      
      // Call the actual handler
      const response = await handler(requestWithId, routeContext);
      
      // Calculate duration
      const duration = Date.now() - startTime;
      
      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);
      
      // Log response
      logResponse(requestLog, response, duration, enhancedContext, defaultOptions);
      
      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const serviceName = context.service || 'ideamem-api';
      const requestLogger = createRequestLogger(requestId, serviceName);
      
      requestLogger.error('API Request Error', error, {
        duration,
        url: request.url,
        method: request.method,
        operation: context.operation,
        resource: context.resource,
        projectId: context.projectId,
        userId: context.userId,
        type: 'request_error',
      });
      
      // Re-throw error to be handled by error middleware
      throw error;
    }
  };
}

/**
 * Pre-configured logging middleware for different use cases
 */
export const LoggingMiddleware = {
  /**
   * Basic API logging
   */
  api: (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    withLogging(handler, { service: 'ideamem-api' }, { logLevel: 'info' }),

  /**
   * CRUD operation logging
   */
  crud: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    resource: string,
    operation: string
  ) =>
    withLogging(handler, { service: 'ideamem-api', resource, operation }),

  /**
   * Authentication operation logging
   */
  auth: (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    withLogging(handler, { service: 'ideamem-auth' }),

  /**
   * MCP operation logging
   */
  mcp: (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    withLogging(handler, { service: 'ideamem-mcp' }),

  /**
   * Database operation logging
   */
  database: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    operation?: string
  ) =>
    withLogging(handler, { service: 'ideamem-database', operation }),

  /**
   * Memory/Vector operation logging
   */
  memory: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    operation?: string
  ) =>
    withLogging(handler, { service: 'ideamem-memory', operation }),

  /**
   * Authenticated operation logging
   */
  authenticated: (
    handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
    context: { userId: string; projectId?: string; operation?: string; service?: string }
  ) =>
    withLogging(handler, context),

  /**
   * Debug logging (includes request/response bodies)
   */
  debug: (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    withLogging(handler, { service: 'ideamem-debug' }, {
      logLevel: 'debug',
      logHeaders: true,
      logBody: true,
      enablePerformanceLogging: true,
    }),

  /**
   * Minimal logging (errors only)
   */
  minimal: (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) =>
    withLogging(handler, { service: 'ideamem-api' }, {
      logLevel: 'error',
      logHeaders: false,
      logBody: false,
      enablePerformanceLogging: false,
    }),
};

/**
 * Export Winston-based Logger utilities for direct use
 */
export { Logger } from '@/lib/logger';

/**
 * Performance logging utility with Winston
 */
export class PerformanceLogger {
  private startTime: number;
  private markers: Map<string, number> = new Map();
  private logger: any;
  
  constructor(private operation: string, private context: LogContext = {}) {
    this.startTime = Date.now();
    const serviceName = context.service || 'ideamem-api';
    this.logger = context.requestId 
      ? createRequestLogger(context.requestId, serviceName)
      : Logger.withService(serviceName);
  }
  
  /**
   * Add a performance marker
   */
  mark(name: string): void {
    this.markers.set(name, Date.now() - this.startTime);
    this.logger.debug(`Performance marker: ${name}`, {
      operation: this.operation,
      marker: name,
      duration: this.markers.get(name),
    });
  }
  
  /**
   * Get duration since start
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
  
  /**
   * Log final performance metrics
   */
  finish(): void {
    const totalDuration = this.getDuration();
    
    Logger.perf(this.operation, totalDuration, {
      markers: Object.fromEntries(this.markers),
      ...this.context,
    }, this.context.service);
  }
}

/**
 * Request timing middleware
 */
export function withTiming(
  handler: (request: NextRequest, perf: PerformanceLogger, context?: any) => Promise<NextResponse>,
  operation: string,
  context: LogContext = {}
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const perf = new PerformanceLogger(operation, context);
    
    try {
      const response = await handler(request, perf, routeContext);
      perf.finish();
      return response;
    } catch (error) {
      perf.mark('error');
      perf.finish();
      throw error;
    }
  };
}