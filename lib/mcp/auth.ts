import { prisma } from '@/lib/database';
import { ToolContext } from './tool';
import { validateBearerToken, AuthContext } from '@/lib/auth';

/**
 * Extract bearer token from request headers
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Extract project ID from request headers
 */
export function extractProjectId(request: Request): string | null {
  return request.headers.get('x-project-id');
}

/**
 * Authenticate a project using legacy bearer token
 */
export async function authenticateProject(token: string): Promise<string | null> {
  if (!token) return null;
  
  try {
    const project = await prisma.project.findUnique({
      where: { token },
      select: { id: true },
    });
    
    return project?.id || null;
  } catch (error) {
    console.error('Error authenticating project:', error);
    return null;
  }
}

/**
 * Create a tool context from a request
 * Supports both legacy project tokens and new user-based tokens
 */
export async function createToolContext(request: Request): Promise<ToolContext> {
  const authHeader = request.headers.get('authorization');
  const projectIdHeader = extractProjectId(request);
  
  // Try to validate the token (supports both types)
  const authContext = await validateBearerToken(authHeader, projectIdHeader);
  
  if (authContext) {
    // Successfully authenticated
    return {
      projectId: authContext.projectId,
      token: authContext.token,
      authContext,
      request,
    };
  }
  
  // No valid authentication
  return {
    projectId: undefined,
    token: undefined,
    authContext: undefined,
    request,
  };
}

/**
 * Helper to require project authentication
 */
export function requireProjectAuth(context: ToolContext): { projectId: string } {
  if (!context.projectId) {
    throw new Error('Project authentication required');
  }
  return { projectId: context.projectId };
}

/**
 * Helper to check if user has permission for a tool
 */
export function hasToolPermission(
  context: ToolContext,
  resource: 'project' | 'preference' | 'doc',
  action: 'read' | 'write' | 'delete' | 'index'
): boolean {
  // Legacy tokens have full access to their project
  if (context.authContext?.type === 'project') {
    return true;
  }
  
  // User tokens need permission check
  if (context.authContext?.type === 'user' && context.authContext.user) {
    const { hasPermission } = require('@/lib/auth');
    return hasPermission(
      context.authContext.user,
      resource,
      action,
      context.projectId
    );
  }
  
  return false;
}