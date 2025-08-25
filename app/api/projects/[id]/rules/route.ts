import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Get project-specific rules from database
    const projectRules = await prisma.projectRule.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to match the expected frontend format
    const rules = projectRules.map(rule => ({
      id: rule.id,
      payload: {
        source: rule.source,
        content: rule.content,
        type: 'rule' as const,
        language: 'markdown' as const,
        scope: 'project' as const,
        project_id: projectId
      }
    }));

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Error fetching project rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project rules' },
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

    // Create the rule in the database
    const rule = await prisma.projectRule.create({
      data: {
        projectId,
        source,
        content,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Rule added successfully',
      rule: {
        id: rule.id,
        payload: {
          source: rule.source,
          content: rule.content,
          type: 'rule' as const,
          language: 'markdown' as const,
          scope: 'project' as const,
          project_id: projectId
        }
      }
    });
  } catch (error: any) {
    console.error('Error adding project rule:', error);
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A rule with this source already exists for this project' 
      }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to add project rule' },
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

    // Update the rule
    const rule = await prisma.projectRule.update({
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
      message: 'Rule updated successfully',
      rule: {
        id: rule.id,
        payload: {
          source: rule.source,
          content: rule.content,
          type: 'rule' as const,
          language: 'markdown' as const,
          scope: 'project' as const,
          project_id: projectId
        }
      }
    });
  } catch (error: any) {
    console.error('Error updating project rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: 'Rule not found' 
      }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to update project rule' },
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

    // Delete the rule
    await prisma.projectRule.delete({
      where: {
        projectId_source: {
          projectId,
          source
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Rule deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting project rule:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: 'Rule not found' 
      }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete project rule' },
      { status: 500 }
    );
  }
}

