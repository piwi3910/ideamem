import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { verifyPassword } from '@/lib/auth/password';
import { generateSecureToken } from '@/lib/auth/password';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

// Schema for login request
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  roleId: z.string().uuid().optional(), // Optional: specific role to use for the token
  tokenName: z.string().max(100).optional(),
  expiresIn: z.number().optional() // Hours until expiration
});

// POST /api/auth/login - Authenticate user and generate token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
  const validation = loginSchema.safeParse(body);
  
  if (!validation.success) {
    return createErrorResponse(
      'Invalid login data',
      HTTP_STATUS.BAD_REQUEST,
      { errors: validation.error.flatten() }
    );
  }

  const { email, password, roleId, tokenName, expiresIn } = validation.data;

  // Find user with roles
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    return createErrorResponse(
      'Invalid email or password',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  // Check if user is active
  if (!user.isActive) {
    return createErrorResponse(
      'Account is disabled',
      HTTP_STATUS.FORBIDDEN
    );
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return createErrorResponse(
      'Invalid email or password',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  // Determine which role to use for the token
  let selectedRoleId: string;
  
  if (roleId) {
    // Verify user has the specified role
    const hasRole = user.roles.some(ur => ur.roleId === roleId);
    if (!hasRole) {
      return createErrorResponse(
        'You do not have the specified role',
        HTTP_STATUS.FORBIDDEN
      );
    }
    selectedRoleId = roleId;
  } else {
    // Use the first role (or the admin role if they have it)
    const adminRole = user.roles.find(ur => ur.role.name === 'Admin');
    if (adminRole) {
      selectedRoleId = adminRole.roleId;
    } else if (user.roles.length > 0) {
      selectedRoleId = user.roles[0].roleId;
    } else {
      return createErrorResponse(
        'User has no assigned roles',
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  // Generate token
  const tokenValue = generateSecureToken(32);
  
  // Calculate expiration (default 30 days)
  const expiresAt = new Date(
    Date.now() + (expiresIn || 720) * 60 * 60 * 1000
  );

  // Create token
  const token = await prisma.token.create({
    data: {
      token: tokenValue,
      name: tokenName || `Login token - ${new Date().toISOString()}`,
      userId: user.id,
      roleId: selectedRoleId,
      expiresAt,
      lastUsedAt: new Date()
    },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          description: true,
          permissions: true
        }
      }
    }
  });

  return createSuccessResponse({
    token: tokenValue,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
        description: ur.role.description
      }))
    },
    currentRole: {
      id: token.role.id,
      name: token.role.name,
      description: token.role.description,
      permissions: JSON.parse(token.role.permissions)
    }
  });
  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(
      'Internal server error during login',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}