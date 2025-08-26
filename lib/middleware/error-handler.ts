import { NextRequest, NextResponse } from 'next/server';
import { handlePrismaError, isPrismaError } from '@/lib/utils/prisma-errors';
import { createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

export type RouteHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

export type ErrorContext = {
  resource?: string;
  operation?: 'create' | 'update' | 'delete' | 'find';
  userId?: string;
  projectId?: string;
};

/**
 * Middleware wrapper that provides unified error handling for route handlers
 */
export function withErrorHandling(
  handler: RouteHandler,
  context: ErrorContext = {}
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      return await handler(request, routeContext);
    } catch (error: any) {
      // Log error with context
      console.error('Route error:', {
        url: request.url,
        method: request.method,
        error: error.message,
        stack: error.stack,
        context,
        userId: context.userId,
        projectId: context.projectId,
      });

      // Handle Prisma-specific errors
      if (isPrismaError(error)) {
        return handlePrismaError(error, context);
      }

      // Handle validation errors (from Zod or custom validation)
      if (error.name === 'ZodError' || error.name === 'ValidationError') {
        return createErrorResponse(
          'Invalid request data',
          HTTP_STATUS.BAD_REQUEST,
          {
            validationErrors: error.issues || error.errors || error.message,
          }
        );
      }

      // Handle authentication errors
      if (error.name === 'AuthenticationError' || error.message?.includes('authentication')) {
        return createErrorResponse(
          'Authentication required',
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Handle authorization errors
      if (error.name === 'AuthorizationError' || error.message?.includes('authorization')) {
        return createErrorResponse(
          'Insufficient permissions',
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Handle rate limiting errors
      if (error.name === 'RateLimitError' || error.message?.includes('rate limit')) {
        return createErrorResponse(
          'Rate limit exceeded - please try again later',
          HTTP_STATUS.TOO_MANY_REQUESTS
        );
      }

      // Handle timeout errors
      if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        return createErrorResponse(
          'Request timeout - please try again',
          HTTP_STATUS.REQUEST_TIMEOUT
        );
      }

      // Generic error handling
      const operation = context.operation ? ` ${context.operation}` : '';
      const resource = context.resource ? ` ${context.resource}` : '';
      
      return createErrorResponse(
        process.env.NODE_ENV === 'development' 
          ? `Error during${operation}${resource} operation: ${error.message}`
          : `Failed to${operation}${resource}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        process.env.NODE_ENV === 'development' ? {
          originalError: error.message,
          stack: error.stack,
        } : undefined
      );
    }
  };
}

/**
 * Specialized error handlers for common operations
 */
export const ErrorHandlers = {
  /**
   * Wrap handler with error handling for CRUD operations
   */
  crud: (
    handler: RouteHandler,
    resource: string,
    operation: ErrorContext['operation']
  ) => withErrorHandling(handler, { resource, operation }),

  /**
   * Wrap handler with error handling for API operations
   */
  api: (handler: RouteHandler, context: ErrorContext = {}) =>
    withErrorHandling(handler, context),

  /**
   * Wrap handler with error handling for authenticated operations
   */
  authenticated: (
    handler: RouteHandler,
    context: Omit<ErrorContext, 'userId'> & { userId: string }
  ) => withErrorHandling(handler, context),

  /**
   * Wrap handler with error handling for project-scoped operations
   */
  projectScoped: (
    handler: RouteHandler,
    context: Omit<ErrorContext, 'projectId'> & { projectId: string }
  ) => withErrorHandling(handler, context),
};

/**
 * Async wrapper for promise-based handlers
 */
export function asyncHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      throw error; // Re-throw to be caught by outer error handler
    }
  };
}

/**
 * Create a pre-configured error handler for preferences
 */
export function createPreferenceErrorHandler(scope: 'global' | 'project') {
  return {
    get: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} preference`, 'find'),
    
    create: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} preference`, 'create'),
    
    update: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} preference`, 'update'),
    
    delete: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} preference`, 'delete'),
  };
}

/**
 * Create a pre-configured error handler for rules
 */
export function createRuleErrorHandler(scope: 'global' | 'project') {
  return {
    get: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} rule`, 'find'),
    
    create: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} rule`, 'create'),
    
    update: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} rule`, 'update'),
    
    delete: (handler: RouteHandler) =>
      ErrorHandlers.crud(handler, `${scope} rule`, 'delete'),
  };
}