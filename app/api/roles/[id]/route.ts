import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { withAdminOnly } from '@/lib/middleware/authorization';
import { createSuccessResponse, createErrorResponse, createNotFoundError, HTTP_STATUS } from '@/lib/utils/responses';
import { RolePermissions } from '@/lib/auth/types';

// Schema for role permissions (reused from parent route)
const permissionsSchema = z.object({
  projects: z.object({
    all: z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional(),
      delete: z.boolean().optional()
    }).optional(),
    specific: z.record(z.string(), z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional(),
      delete: z.boolean().optional()
    })).optional()
  }).optional(),
  global: z.object({
    preferences: z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional()
    }).optional(),
    docs: z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional(),
      index: z.boolean().optional()
    }).optional(),
    users: z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional(),
      delete: z.boolean().optional()
    }).optional(),
    roles: z.object({
      read: z.boolean().optional(),
      write: z.boolean().optional(),
      delete: z.boolean().optional()
    }).optional()
  }).optional(),
  system: z.object({
    admin: z.boolean().optional()
  }).optional()
});

// Schema for updating a role
const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema.optional()
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roles/[id] - Get a specific role (admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
  const { id } = await params;
  
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      users: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      },
      _count: {
        select: {
          tokens: true
        }
      }
    }
  });

  if (!role) {
    return createNotFoundError('Role not found');
  }

  return createSuccessResponse({
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: JSON.parse(role.permissions) as RolePermissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      users: role.users.map(ur => ur.user),
      tokenCount: role._count.tokens
    }
  });
  })(request);
}

// PUT /api/roles/[id] - Update a role (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
  const { id } = await params;
  const body = await request.json();
  
  const validation = updateRoleSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      'Invalid role data',
      HTTP_STATUS.BAD_REQUEST,
      { errors: validation.error.flatten() }
    );
  }

  const { name, description, permissions } = validation.data;

  // Check if role exists
  const existingRole = await prisma.role.findUnique({
    where: { id }
  });

  if (!existingRole) {
    return createNotFoundError('Role not found');
  }

  // Prevent modifying system roles
  if (existingRole.isSystem) {
    return createErrorResponse(
      'Cannot modify system roles',
      HTTP_STATUS.FORBIDDEN
    );
  }

  // Check if name is already taken by another role
  if (name && name !== existingRole.name) {
    const nameExists = await prisma.role.findUnique({
      where: { name }
    });
    
    if (nameExists) {
      return createErrorResponse(
        'Role name already in use',
        HTTP_STATUS.CONFLICT
      );
    }
  }

  // Update role
  const updatedRole = await prisma.role.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(permissions && { permissions: JSON.stringify(permissions) }),
      updatedAt: new Date()
    }
  });

  return createSuccessResponse({
    role: {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
      permissions: JSON.parse(updatedRole.permissions) as RolePermissions,
      isSystem: updatedRole.isSystem,
      updatedAt: updatedRole.updatedAt
    }
  });
  })(request);
}

// DELETE /api/roles/[id] - Delete a role (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
  const { id } = await params;

  // Check if role exists
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          tokens: true
        }
      }
    }
  });

  if (!role) {
    return createNotFoundError('Role not found');
  }

  // Prevent deleting system roles
  if (role.isSystem) {
    return createErrorResponse(
      'Cannot delete system roles',
      HTTP_STATUS.FORBIDDEN
    );
  }

  // Prevent deleting roles that are in use
  if (role._count.users > 0 || role._count.tokens > 0) {
    return createErrorResponse(
      `Cannot delete role that is assigned to ${role._count.users} users and ${role._count.tokens} tokens`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Delete role
  await prisma.role.delete({
    where: { id }
  });

  return createSuccessResponse({
    message: 'Role deleted successfully'
  });
  })(request);
}