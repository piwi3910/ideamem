import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { withAdminOnly } from '@/lib/middleware/authorization';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { RolePermissions } from '@/lib/auth/types';

// Schema for role permissions
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

// Schema for creating a role
const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema,
  isSystem: z.boolean().optional().default(false)
});

// GET /api/roles - List all roles (admin only)
export const GET = withAdminOnly(async (request: NextRequest) => {
  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: {
          users: true,
          tokens: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Transform the data for easier consumption
  const transformedRoles = roles.map(role => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: JSON.parse(role.permissions) as RolePermissions,
    isSystem: role.isSystem,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    userCount: role._count.users,
    tokenCount: role._count.tokens
  }));

  return createSuccessResponse({
    roles: transformedRoles,
    total: transformedRoles.length
  });
});

// POST /api/roles - Create a new role (admin only)
export const POST = withAdminOnly(async (request: NextRequest) => {
  const body = await request.json();
  const validation = createRoleSchema.safeParse(body);
  
  if (!validation.success) {
    return createErrorResponse(
      'Invalid role data',
      HTTP_STATUS.BAD_REQUEST,
      { errors: validation.error.flatten() }
    );
  }

  const { name, description, permissions, isSystem } = validation.data;

  // Check if role already exists
  const existingRole = await prisma.role.findUnique({
    where: { name }
  });

  if (existingRole) {
    return createErrorResponse(
      'Role with this name already exists',
      HTTP_STATUS.CONFLICT
    );
  }

  // Create the role
  const role = await prisma.role.create({
    data: {
      name,
      description,
      permissions: JSON.stringify(permissions),
      isSystem
    }
  });

  return createSuccessResponse({
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: JSON.parse(role.permissions) as RolePermissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt
    }
  }, HTTP_STATUS.CREATED);
});