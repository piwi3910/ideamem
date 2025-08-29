import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { withAdminOnly } from '@/lib/middleware/authorization';
import { hashPassword } from '@/lib/auth/password';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

// Schema for creating a user
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
  roleIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional().default(true)
});

// GET /api/users - List all users (admin only)
export const GET = withAdminOnly(async (request: NextRequest) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      },
      _count: {
        select: {
          tokens: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Transform the data for easier consumption
  const transformedUsers = users.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map(ur => ur.role),
    tokenCount: user._count.tokens
  }));

  return createSuccessResponse({
    users: transformedUsers,
    total: transformedUsers.length
  });
});

// POST /api/users - Create a new user (admin only)
export const POST = withAdminOnly(async (request: NextRequest, authContext) => {
  const body = await request.json();
  const validation = createUserSchema.safeParse(body);
  
  if (!validation.success) {
    return createErrorResponse(
      'Invalid user data',
      HTTP_STATUS.BAD_REQUEST,
      { errors: validation.error.flatten() }
    );
  }

  const { email, name, password, roleIds, isActive } = validation.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    return createErrorResponse(
      'User with this email already exists',
      HTTP_STATUS.CONFLICT
    );
  }

  // Hash the password
  const passwordHash = await hashPassword(password);

  // Create the user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      isActive,
      roles: roleIds && roleIds.length > 0 ? {
        create: roleIds.map(roleId => ({
          roleId,
          assignedBy: authContext.user?.userId
        }))
      } : undefined
    },
    include: {
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      }
    }
  });

  return createSuccessResponse({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: user.roles.map(ur => ur.role)
    }
  }, HTTP_STATUS.CREATED);
});