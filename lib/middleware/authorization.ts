import { NextRequest, NextResponse } from 'next/server';
import { validateBearerToken, hasPermission, AuthContext } from '@/lib/auth';
import { createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { loggers } from '@/lib/logger';

export type ResourceType = 'project' | 'preference' | 'doc' | 'user' | 'role';
export type ActionType = 'read' | 'write' | 'delete' | 'index';

export interface AuthorizationOptions {
  resource: ResourceType;
  action: ActionType;
  projectIdParam?: string; // Name of the param that contains project ID
  requireProjectId?: boolean; // Whether project ID is required
  allowLegacyTokens?: boolean; // Whether to allow legacy project tokens
}

/**
 * Authorization middleware that checks user permissions
 */
export function withAuthorization(
  options: AuthorizationOptions,
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Get auth header and project ID header
      const authHeader = request.headers.get('authorization');
      const projectIdHeader = request.headers.get('x-project-id');
      
      // Validate token
      const authContext = await validateBearerToken(authHeader, projectIdHeader);
      
      if (!authContext) {
        return createErrorResponse(
          'Invalid or missing authentication token',
          HTTP_STATUS.UNAUTHORIZED
        );
      }
      
      // Check if legacy tokens are allowed
      if (authContext.type === 'project' && !options.allowLegacyTokens) {
        return createErrorResponse(
          'Legacy project tokens are not allowed for this endpoint. Please use user-based authentication.',
          HTTP_STATUS.FORBIDDEN
        );
      }
      
      // For user tokens, check permissions
      if (authContext.type === 'user' && authContext.user) {
        // Determine the project ID for authorization
        let projectId: string | undefined;
        
        if (options.projectIdParam) {
          // Get project ID from URL params
          const url = new URL(request.url);
          const pathSegments = url.pathname.split('/');
          const paramIndex = pathSegments.findIndex(seg => seg === options.projectIdParam);
          if (paramIndex !== -1 && paramIndex < pathSegments.length - 1) {
            projectId = pathSegments[paramIndex + 1];
          }
        } else if (projectIdHeader) {
          projectId = projectIdHeader;
        } else if (authContext.projectId) {
          projectId = authContext.projectId;
        }
        
        // Check if project ID is required
        if (options.requireProjectId && !projectId) {
          return createErrorResponse(
            'Project ID is required for this operation',
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // Check permissions
        const hasAccess = hasPermission(
          authContext.user,
          options.resource,
          options.action,
          projectId
        );
        
        if (!hasAccess) {
          loggers.auth.warn('Permission denied', {
            userId: authContext.user.userId,
            resource: options.resource,
            action: options.action,
            projectId
          });
          
          return createErrorResponse(
            `You don't have permission to ${options.action} ${options.resource}`,
            HTTP_STATUS.FORBIDDEN
          );
        }
        
        // Update auth context with resolved project ID
        if (projectId) {
          authContext.projectId = projectId;
        }
      }
      
      // Call the handler with auth context
      return handler(request, authContext);
      
    } catch (error) {
      loggers.api.error('Authorization middleware error', error);
      return createErrorResponse(
        'Authorization failed',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
}

/**
 * Convenience middleware for admin-only endpoints
 */
export function withAdminOnly(
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authHeader = request.headers.get('authorization');
    const authContext = await validateBearerToken(authHeader, null);
    
    if (!authContext) {
      return createErrorResponse(
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }
    
    if (authContext.type !== 'user' || !authContext.user) {
      return createErrorResponse(
        'User authentication required',
        HTTP_STATUS.FORBIDDEN
      );
    }
    
    // Check for admin permission
    if (!authContext.user.currentRole?.permissions.system?.admin) {
      return createErrorResponse(
        'Admin access required',
        HTTP_STATUS.FORBIDDEN
      );
    }
    
    return handler(request, authContext);
  };
}

/**
 * Middleware that allows both authenticated and unauthenticated access
 * but provides auth context if available
 */
export function withOptionalAuth(
  handler: (request: NextRequest, context?: AuthContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authHeader = request.headers.get('authorization');
    const projectIdHeader = request.headers.get('x-project-id');
    
    let authContext: AuthContext | null = null;
    
    if (authHeader) {
      authContext = await validateBearerToken(authHeader, projectIdHeader);
    }
    
    return handler(request, authContext || undefined);
  };
}