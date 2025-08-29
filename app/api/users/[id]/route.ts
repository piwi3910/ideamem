import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { withAdminOnly } from '@/lib/middleware/authorization';
import { hashPassword } from '@/lib/auth/password';
import { createSuccessResponse, createErrorResponse, createNotFoundError, HTTP_STATUS } from '@/lib/utils/responses';

// Schema for updating a user
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional()
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get a specific user (admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
    const { id } = await params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        tokens: {
          where: {
            revokedAt: null
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return createNotFoundError('User not found');
    }

    return createSuccessResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: user.roles.map(ur => ur.role),
        tokens: user.tokens
      }
    });
  })(request);
}

// PUT /api/users/[id] - Update a user (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
    const { id } = await params;
    const body = await request.json();
    
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse(
        'Invalid user data',
        HTTP_STATUS.BAD_REQUEST,
        { errors: validation.error.flatten() }
      );
    }

    const { email, name, password, isActive, roleIds } = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return createNotFoundError('User not found');
    }

    // Check if email is already taken by another user
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      
      if (emailExists) {
        return createErrorResponse(
          'Email already in use',
          HTTP_STATUS.CONFLICT
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(email && { email }),
      ...(name && { name }),
      ...(password && { passwordHash: await hashPassword(password) }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date()
    };

    // Update user
    const user = await prisma.$transaction(async (tx) => {
      // Update user fields
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData
      });

      // Update roles if provided
      if (roleIds !== undefined) {
        // Remove all existing roles
        await tx.userRole.deleteMany({
          where: { userId: id }
        });

        // Add new roles
        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map(roleId => ({
              userId: id,
              roleId,
              assignedBy: authContext.user?.userId
            }))
          });
        }
      }

      // Return updated user with roles
      return tx.user.findUnique({
        where: { id },
        include: {
          roles: {
            include: {
              role: true
            }
          }
        }
      });
    });

    return createSuccessResponse({
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        isActive: user!.isActive,
        updatedAt: user!.updatedAt,
        roles: user!.roles.map(ur => ur.role)
      }
    });
  })(request);
}

// DELETE /api/users/[id] - Delete a user (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAdminOnly(async (request: NextRequest, authContext) => {
    const { id } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return createNotFoundError('User not found');
    }

    // Prevent deleting yourself
    if (authContext.user?.userId === id) {
      return createErrorResponse(
        'Cannot delete your own user account',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Delete user (cascades to roles and tokens)
    await prisma.user.delete({
      where: { id }
    });

    return createSuccessResponse({
      message: 'User deleted successfully'
    });
  })(request);
}