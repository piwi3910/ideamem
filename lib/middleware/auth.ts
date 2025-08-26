import { NextRequest, NextResponse } from 'next/server';
import { validateBearerToken } from '@/lib/auth';
import { createUnauthorizedError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

export type AuthContext = {
  projectId: string;
  projectName: string;
  gitRepo: string;
  token: string;
};

export type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: { auth: AuthContext; params?: any }
) => Promise<NextResponse> | NextResponse;

export type OptionalAuthRouteHandler = (
  request: NextRequest,
  context: { auth?: AuthContext; params?: any }
) => Promise<NextResponse> | NextResponse;

/**
 * Middleware to require Bearer token authentication
 */
export function withAuth(handler: AuthenticatedRouteHandler) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return createUnauthorizedError('Authorization header required');
    }

    const authResult = await validateBearerToken(authHeader);
    
    if (!authResult) {
      return createUnauthorizedError('Invalid or expired token');
    }

    // Add auth context to the handler
    const context = {
      auth: authResult,
      params: routeContext?.params,
    };

    return handler(request, context);
  };
}

/**
 * Middleware for optional authentication (auth context available if token provided)
 */
export function withOptionalAuth(handler: OptionalAuthRouteHandler) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const authHeader = request.headers.get('Authorization');
    let authResult: AuthContext | undefined;

    if (authHeader) {
      authResult = await validateBearerToken(authHeader) || undefined;
    }

    const context = {
      auth: authResult,
      params: routeContext?.params,
    };

    return handler(request, context);
  };
}

/**
 * Middleware to validate project access (token must belong to specific project)
 */
export function withProjectAuth(handler: AuthenticatedRouteHandler) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return createUnauthorizedError('Authorization header required');
    }

    const authResult = await validateBearerToken(authHeader);
    
    if (!authResult) {
      return createUnauthorizedError('Invalid or expired token');
    }

    // Extract project ID from route params if available
    const routeProjectId = routeContext?.params?.id;
    
    // Validate project access if project ID is in route
    if (routeProjectId && authResult.projectId !== routeProjectId) {
      return createErrorResponse(
        'Token does not have access to this project',
        HTTP_STATUS.FORBIDDEN
      );
    }

    const context = {
      auth: authResult,
      params: routeContext?.params,
    };

    return handler(request, context);
  };
}

/**
 * Extract auth context from request (for use in other middleware)
 */
export async function extractAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }

  return await validateBearerToken(authHeader);
}

/**
 * Create auth context for error handling
 */
export function createAuthErrorContext(auth?: AuthContext) {
  return {
    userId: auth?.token,
    projectId: auth?.projectId,
  };
}

/**
 * Combine auth middleware with error handling
 */
export function withAuthAndErrorHandling(
  handler: AuthenticatedRouteHandler,
  errorContext: { resource?: string; operation?: string } = {}
) {
  return withAuth(async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error: any) {
      console.error('Authenticated route error:', {
        url: request.url,
        method: request.method,
        projectId: context.auth.projectId,
        error: error.message,
        ...errorContext,
      });
      
      throw error; // Re-throw for outer error handling
    }
  });
}

/**
 * Common auth patterns for different route types
 */
export const AuthPatterns = {
  /**
   * For routes that require project-specific authentication
   */
  projectRequired: (handler: AuthenticatedRouteHandler) =>
    withProjectAuth(handler),

  /**
   * For routes that work with any valid token
   */
  tokenRequired: (handler: AuthenticatedRouteHandler) =>
    withAuth(handler),

  /**
   * For routes that enhance behavior with auth but don't require it
   */
  tokenOptional: (handler: OptionalAuthRouteHandler) =>
    withOptionalAuth(handler),

  /**
   * For MCP routes that need token-based project context
   */
  mcpTokenRequired: (handler: AuthenticatedRouteHandler) =>
    withAuth(handler),
};

/**
 * Validate that auth context has required project access
 */
export function validateProjectAccess(
  auth: AuthContext | undefined,
  requiredProjectId: string
): boolean {
  return auth?.projectId === requiredProjectId;
}

/**
 * Create middleware that validates specific project access
 */
export function requireProjectAccess(projectId: string) {
  return (handler: AuthenticatedRouteHandler) => {
    return withAuth(async (request, context) => {
      if (!validateProjectAccess(context.auth, projectId)) {
        return createErrorResponse(
          'Access denied for this project',
          HTTP_STATUS.FORBIDDEN
        );
      }

      return handler(request, context);
    });
  };
}