import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// GET - Fetch all global preferences
export async function GET() {
  try {
    const globalPreferences = await prisma.globalPreference.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to match the expected frontend format
    const preferences = globalPreferences.map(preference => ({
      id: preference.id,
      payload: {
        source: preference.source,
        content: preference.content,
        type: 'user_preference' as const,
        language: 'markdown' as const,
        scope: 'global' as const,
        project_id: 'global'
      }
    }));

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error: any) {
    console.error('Error fetching global preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch global preferences' },
      { status: 500 }
    );
  }
}

// POST - Add new global preference
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, content } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Create the preference in the database
    const preference = await prisma.globalPreference.create({
      data: {
        source,
        content,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Preference added successfully',
      preference: {
        id: preference.id,
        payload: {
          source: preference.source,
          content: preference.content,
          type: 'user_preference' as const,
          language: 'markdown' as const,
          scope: 'global' as const,
          project_id: 'global'
        }
      }
    });
  } catch (error: any) {
    console.error('Error adding global preference:', error);
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        success: false, 
        error: 'A preference with this source already exists' 
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to add preference' }, { status: 500 });
  }
}

// PUT - Update existing global preference
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { source, content } = body;

    if (!source || !content) {
      return NextResponse.json(
        { success: false, error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Update the preference by source
    const preference = await prisma.globalPreference.update({
      where: { source },
      data: { content },
    });

    return NextResponse.json({
      success: true,
      message: 'Preference updated successfully',
      preference: {
        id: preference.id,
        payload: {
          source: preference.source,
          content: preference.content,
          type: 'user_preference' as const,
          language: 'markdown' as const,
          scope: 'global' as const,
          project_id: 'global'
        }
      }
    });
  } catch (error: any) {
    console.error('Error updating global preference:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false, 
        error: 'Preference not found' 
      }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update preference' }, { status: 500 });
  }
}

// DELETE - Remove global preference
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { source } = body;

    if (!source) {
      return NextResponse.json({ success: false, error: 'Source is required' }, { status: 400 });
    }

    // Delete the preference by source
    await prisma.globalPreference.delete({
      where: { source }
    });

    return NextResponse.json({
      success: true,
      message: 'Preference deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting global preference:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        success: false, 
        error: 'Preference not found' 
      }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete preference' }, { status: 500 });
  }
}
