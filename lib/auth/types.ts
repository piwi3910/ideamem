/**
 * Types for user-based authentication and RBAC
 */

export interface UserContext {
  userId: string;
  email: string;
  name: string;
  roles: RoleContext[];
  currentRole?: RoleContext; // The role associated with the current token
}

export interface RoleContext {
  id: string;
  name: string;
  permissions: RolePermissions;
}

export interface RolePermissions {
  projects?: {
    all?: {
      read?: boolean;
      write?: boolean;
      delete?: boolean;
    };
    specific?: {
      [projectId: string]: {
        read?: boolean;
        write?: boolean;
        delete?: boolean;
      };
    };
  };
  global?: {
    preferences?: {
      read?: boolean;
      write?: boolean;
    };
    docs?: {
      read?: boolean;
      write?: boolean;
      index?: boolean;
    };
    users?: {
      read?: boolean;
      write?: boolean;
      delete?: boolean;
    };
    roles?: {
      read?: boolean;
      write?: boolean;
      delete?: boolean;
    };
  };
  system?: {
    admin?: boolean;
  };
}

export type PermissionAction = 'read' | 'write' | 'delete' | 'index';
export type ResourceType = 'project' | 'preference' | 'doc' | 'user' | 'role';

export interface AuthenticatedRequest {
  user: UserContext;
  projectId?: string; // From X-Project-ID header
}

// Predefined system roles
export const SYSTEM_ROLES = {
  ADMIN: {
    name: 'Admin',
    description: 'Full system access',
    permissions: {
      projects: {
        all: { read: true, write: true, delete: true }
      },
      global: {
        preferences: { read: true, write: true },
        docs: { read: true, write: true, index: true },
        users: { read: true, write: true, delete: true },
        roles: { read: true, write: true, delete: true }
      },
      system: {
        admin: true
      }
    }
  },
  DEVELOPER: {
    name: 'Developer',
    description: 'Read/write access to assigned projects',
    permissions: {
      projects: {
        all: { read: true, write: true, delete: false }
      },
      global: {
        preferences: { read: true, write: false },
        docs: { read: true, write: false, index: false }
      }
    }
  },
  READONLY: {
    name: 'Read-Only',
    description: 'Read-only access to assigned projects',
    permissions: {
      projects: {
        all: { read: true, write: false, delete: false }
      },
      global: {
        preferences: { read: true, write: false },
        docs: { read: true, write: false, index: false }
      }
    }
  }
} as const;