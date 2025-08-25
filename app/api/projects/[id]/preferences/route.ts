import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Get project-specific preferences from database
    const projectPreferences = await prisma.projectPreference.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to match the expected frontend format
    const preferences = projectPreferences.map(preference => ({
      id: preference.id,
      payload: {
        source: preference.source,
        content: preference.content,
        type: 'user_preference' as const,
        language: 'markdown' as const,
        scope: 'project' as const,
        project_id: projectId
      }
    }));

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('Error fetching project preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project preferences' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { source, content } = await request.json();

    if (!source || !content) {
      return NextResponse.json(
        { error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Create the preference in the database
    const preference = await prisma.projectPreference.create({
      data: {
        projectId,
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
          scope: 'project' as const,
          project_id: projectId
        }
      }
    });
  } catch (error: any) {
    console.error('Error adding project preference:', error);
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A preference with this source already exists for this project' 
      }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to add project preference' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { source, content } = await request.json();

    if (!source || !content) {
      return NextResponse.json(
        { error: 'Source and content are required' },
        { status: 400 }
      );
    }

    // Update the preference
    const preference = await prisma.projectPreference.update({
      where: { 
        projectId_source: {
          projectId,
          source
        }
      },
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
          scope: 'project' as const,
          project_id: projectId
        }
      }
    });
  } catch (error: any) {
    console.error('Error updating project preference:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: 'Preference not found' 
      }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update project preference' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');

    if (!source) {
      return NextResponse.json(
        { error: 'Source parameter is required' },
        { status: 400 }
      );
    }

    // Delete the preference
    await prisma.projectPreference.delete({
      where: {
        projectId_source: {
          projectId,
          source
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Preference deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting project preference:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: 'Preference not found' 
      }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete project preference' },
      { status: 500 }
    );
  }
}

