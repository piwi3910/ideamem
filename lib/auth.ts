import { getProjectByToken } from '@/lib/projects';
import { loggers } from '@/lib/logger';
import { validateUserToken, hasPermission } from './auth/user-auth';
import { UserContext } from './auth/types';

export interface AuthContext {
  type: 'project' | 'user';
  projectId?: string;
  projectName?: string;
  gitRepo?: string;
  token: string;
  user?: UserContext;
}

/**
 * Validate Bearer token - supports both legacy project tokens and new user tokens
 */
export async function validateBearerToken(
  authHeader: string | null,
  projectIdHeader?: string | null
): Promise<AuthContext | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring('Bearer '.length);
  
  // First, try to validate as a user token
  try {
    const userContext = await validateUserToken(authHeader);
    if (userContext) {
      // For user tokens, check if they have access to the requested project
      if (projectIdHeader) {
        const hasAccess = hasPermission(userContext, 'project', 'read', projectIdHeader);
        if (!hasAccess) {
          loggers.auth.warn('User lacks access to project', {
            userId: userContext.userId,
            projectId: projectIdHeader
          });
          return null;
        }
      }
      
      return {
        type: 'user',
        projectId: projectIdHeader || undefined,
        token,
        user: userContext
      };
    }
  } catch (error) {
    loggers.auth.error('User token validation error', error);
  }
  
  // Fall back to legacy project token validation
  try {
    const project = await getProjectByToken(token);
    if (project) {
      // Legacy tokens ignore the X-Project-ID header
      return {
        type: 'project',
        projectId: project.id,
        projectName: project.name,
        gitRepo: project.gitRepo,
        token: token
      };
    }
  } catch (error) {
    loggers.auth.error('Project token validation failed', error, {
      tokenPrefix: token.substring(0, 8) + '...',
    });
  }

  return null;
}

// Re-export for convenience
export { validateUserToken, hasPermission } from './auth/user-auth';
export type { UserContext, RoleContext, RolePermissions } from './auth/types';