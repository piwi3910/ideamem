import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { withAuthorization } from '@/lib/middleware/authorization';
import { generateSecureToken } from '@/lib/auth/password';
import { createSuccessResponse, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { AuthContext } from '@/lib/auth';

// Schema for creating a token
const createTokenSchema = z.object({
  name: z.string().max(100).optional(),
  roleId: z.string().uuid(),
  expiresIn: z.number().optional() // Hours until expiration
});

// GET /api/tokens - List all tokens for the authenticated user
export const GET = withAuthorization(
  { resource: 'user', action: 'read', allowLegacyTokens: false },
  async (request: NextRequest, authContext: AuthContext) => {
    if (!authContext.user) {
      return createErrorResponse('User authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const tokens = await prisma.token.findMany({
      where: {
        userId: authContext.user.userId,
        revokedAt: null
      },
      select: {
        id: true,
        name: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Mask tokens for security (show only first and last 4 characters)
    const maskedTokens = tokens.map(token => ({
      ...token,
      token: token.token.length > 8 
        ? `${token.token.substring(0, 4)}...${token.token.substring(token.token.length - 4)}`
        : '********'
    }));

    return createSuccessResponse({
      tokens: maskedTokens,
      total: maskedTokens.length
    });
  }
);

// POST /api/tokens - Generate a new token for the authenticated user
export const POST = withAuthorization(
  { resource: 'user', action: 'write', allowLegacyTokens: false },
  async (request: NextRequest, authContext: AuthContext) => {
    if (!authContext.user) {
      return createErrorResponse('User authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const body = await request.json();
    const validation = createTokenSchema.safeParse(body);
    
    if (!validation.success) {
      return createErrorResponse(
        'Invalid token data',
        HTTP_STATUS.BAD_REQUEST,
        { errors: validation.error.flatten() }
      );
    }

    const { name, roleId, expiresIn } = validation.data;

    // Verify the user has the specified role
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: authContext.user.userId,
        roleId: roleId
      }
    });

    if (!userRole) {
      return createErrorResponse(
        'You do not have the specified role',
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Generate secure token
    const tokenValue = generateSecureToken(32);

    // Calculate expiration
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
      : undefined;

    // Create the token
    const token = await prisma.token.create({
      data: {
        token: tokenValue,
        name,
        userId: authContext.user.userId,
        roleId,
        expiresAt
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    return createSuccessResponse({
      token: {
        id: token.id,
        token: token.token, // Return full token only on creation
        name: token.name,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        role: token.role
      },
      message: 'Token created successfully. Please save it securely as it will not be shown again.'
    }, HTTP_STATUS.CREATED);
  }
);