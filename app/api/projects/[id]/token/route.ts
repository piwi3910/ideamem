import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { regenerateToken } from '@/lib/projects';
import { withValidation } from '@/lib/middleware/validation';
import { Schemas } from '@/lib/schemas';

export const POST = withValidation(
  { params: Schemas.params.id },
  async (_request: NextRequest, { params }) => {
    try {
      const newToken = await regenerateToken(params.id);

      if (!newToken) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      return NextResponse.json({ token: newToken });
    } catch (error) {
      console.error('Error regenerating token:', error);
      return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
    }
  }
);
