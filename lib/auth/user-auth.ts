import { prisma } from '@/lib/database';
import { loggers } from '@/lib/logger';
import { UserContext, RoleContext, RolePermissions } from './types';

/**
 * Validate a user-based Bearer token
 */
export async function validateUserToken(authHeader: string | null): Promise<UserContext | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const tokenValue = authHeader.substring('Bearer '.length);
  
  try {
    // Look up the token with user and role information
    const token = await prisma.token.findUnique({
      where: { 
        token: tokenValue,
        revokedAt: null // Ensure token is not revoked
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true
              }
            }
          }
        },
        role: true
      }
    });

    if (!token) {
      return null;
    }

    // Check if token is expired
    if (token.expiresAt && token.expiresAt < new Date()) {
      loggers.auth.warn('Token expired', { tokenId: token.id });
      return null;
    }

    // Check if user is active
    if (!token.user.isActive) {
      loggers.auth.warn('User inactive', { userId: token.user.id });
      return null;
    }

    // Update last used timestamp
    await prisma.token.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() }
    }).catch(err => {
      loggers.auth.error('Failed to update token lastUsedAt', err);
    });

    // Parse role permissions
    const currentRolePermissions = JSON.parse(token.role.permissions) as RolePermissions;
    
    // Build user context
    const userContext: UserContext = {
      userId: token.user.id,
      email: token.user.email,
      name: token.user.name,
      roles: token.user.roles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        permissions: JSON.parse(ur.role.permissions) as RolePermissions
      })),
      currentRole: {
        id: token.role.id,
        name: token.role.name,
        permissions: currentRolePermissions
      }
    };

    return userContext;
  } catch (error) {
    loggers.auth.error('User token validation failed', error, {
      tokenPrefix: tokenValue.substring(0, 8) + '...',
    });
    return null;
  }
}

/**
 * Check if a user has permission for a specific action on a resource
 */
export function hasPermission(
  user: UserContext,
  resource: 'project' | 'preference' | 'doc' | 'user' | 'role',
  action: 'read' | 'write' | 'delete' | 'index',
  projectId?: string
): boolean {
  const permissions = user.currentRole?.permissions;
  
  if (!permissions) {
    return false;
  }

  // System admin has all permissions
  if (permissions.system?.admin) {
    return true;
  }

  // Check project-specific permissions
  if (resource === 'project' && projectId) {
    // Check specific project permissions first
    const specificProjectPerms = permissions.projects?.specific?.[projectId];
    if (specificProjectPerms?.[action]) {
      return true;
    }
    
    // Fall back to general project permissions
    const allProjectPerms = permissions.projects?.all;
    if (allProjectPerms?.[action]) {
      return true;
    }
    
    return false;
  }

  // Check global permissions
  if (resource === 'preference') {
    return permissions.global?.preferences?.[action as 'read' | 'write'] ?? false;
  }
  
  if (resource === 'doc') {
    return permissions.global?.docs?.[action as 'read' | 'write' | 'index'] ?? false;
  }
  
  if (resource === 'user') {
    return permissions.global?.users?.[action as 'read' | 'write' | 'delete'] ?? false;
  }
  
  if (resource === 'role') {
    return permissions.global?.roles?.[action as 'read' | 'write' | 'delete'] ?? false;
  }

  return false;
}

/**
 * Get all project IDs a user has access to
 */
export function getAccessibleProjectIds(user: UserContext): string[] | 'all' {
  const permissions = user.currentRole?.permissions;
  
  if (!permissions) {
    return [];
  }

  // System admin or has access to all projects
  if (permissions.system?.admin || permissions.projects?.all?.read) {
    return 'all';
  }

  // Return specific project IDs
  const specificProjects = permissions.projects?.specific;
  if (specificProjects) {
    return Object.keys(specificProjects).filter(
      projectId => specificProjects[projectId].read
    );
  }

  return [];
}