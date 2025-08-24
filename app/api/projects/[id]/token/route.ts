import { NextResponse } from 'next/server';
import { regenerateToken } from '@/lib/projects';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const newToken = await regenerateToken(id);
    
    if (!newToken) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ token: newToken });
  } catch (error) {
    console.error('Error regenerating token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate token' },
      { status: 500 }
    );
  }
}