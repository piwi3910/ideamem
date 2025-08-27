import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { regenerateToken } from '@/lib/projects';
import { composeMiddleware } from '@/lib/middleware/compose';
import { Schemas } from '@/lib/schemas';

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 5, window: '5 m' }, // Limit token regeneration
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: Schemas.params.id },
    errorHandling: { context: { resource: 'project-token' } },
  },
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const newToken = await regenerateToken(params.id);

    if (!newToken) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ token: newToken });
  }
);
