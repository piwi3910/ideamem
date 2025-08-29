import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { withAuthorization } from '@/lib/middleware/authorization';
import { createSuccessResponse, createErrorResponse, createNotFoundError, HTTP_STATUS } from '@/lib/utils/responses';
import { AuthContext } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/tokens/[id] - Revoke a token
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuthorization(
    { resource: 'user', action: 'delete', allowLegacyTokens: false },
    async (request: NextRequest, authContext: AuthContext) => {
    if (!authContext.user) {
      return createErrorResponse('User authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const { id } = await params;

    // Find the token
    const token = await prisma.token.findUnique({
      where: { id }
    });

    if (!token) {
      return createNotFoundError('Token not found');
    }

    // Check if the user owns the token (or is an admin)
    const isAdmin = authContext.user.currentRole?.permissions.system?.admin;
    if (token.userId !== authContext.user.userId && !isAdmin) {
      return createErrorResponse(
        'You can only revoke your own tokens',
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Prevent revoking the current token
    if (token.token === authContext.token) {
      return createErrorResponse(
        'Cannot revoke the token you are currently using',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Soft delete (revoke) the token
    await prisma.token.update({
      where: { id },
      data: {
        revokedAt: new Date()
      }
    });

    return createSuccessResponse({
      message: 'Token revoked successfully'
    });
    }
  )(request);
}