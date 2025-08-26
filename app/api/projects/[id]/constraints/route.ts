import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Unified API for all project constraints (all categories under preferences)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    
    const preferences = await prisma.projectPreference.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to include category information
    const constraints = preferences.map(preference => ({
      id: preference.id,
      payload: {
        source: preference.source,
        content: preference.content,
        category: preference.category,
        type: 'user_preference',
        language: 'markdown',
        scope: 'project',
        project_id: projectId
      }
    }));

    return createSuccessResponse({
      constraints,
      category_counts: {
        rule: preferences.filter(p => p.category === 'rule').length,
        tooling: preferences.filter(p => p.category === 'tooling').length,
        workflow: preferences.filter(p => p.category === 'workflow').length,
        formatting: preferences.filter(p => p.category === 'formatting').length,
      },
      total: preferences.length
    });
  } catch (error: any) {
    console.error('Error fetching project constraints:', error);
    return createErrorResponse('Failed to fetch project constraints', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// POST - Add new project constraint
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();
    const { source, content, category } = body;

    if (!source || !content) {
      return createErrorResponse('Source and content are required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!['rule', 'tooling', 'workflow', 'formatting'].includes(category)) {
      return createErrorResponse('Category must be one of: rule, tooling, workflow, formatting', HTTP_STATUS.BAD_REQUEST);
    }

    const preference = await prisma.projectPreference.create({
      data: {
        projectId,
        source,
        content,
        category: category || 'rule'
      },
    });

    return createSuccessResponse(
      {
        constraint: {
          id: preference.id,
          payload: {
            source: preference.source,
            content: preference.content,
            category: preference.category,
            type: 'user_preference',
            language: 'markdown',
            scope: 'project',
            project_id: projectId
          }
        },
        message: 'Constraint added successfully'
      },
      'Constraint added successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error: any) {
    console.error('Error adding project constraint:', error);
    if (error.code === 'P2002') {
      return createErrorResponse('A constraint with this source already exists for this project', HTTP_STATUS.CONFLICT);
    }
    return createErrorResponse('Failed to add constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// PUT - Update existing project constraint
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();
    const { source, content, category } = body;

    if (!source || !content) {
      return createErrorResponse('Source and content are required', HTTP_STATUS.BAD_REQUEST);
    }

    if (category && !['rule', 'tooling', 'workflow', 'formatting'].includes(category)) {
      return createErrorResponse('Category must be one of: rule, tooling, workflow, formatting', HTTP_STATUS.BAD_REQUEST);
    }

    const preference = await prisma.projectPreference.update({
      where: {
        projectId_source: {
          projectId,
          source
        }
      },
      data: { 
        content,
        ...(category && { category })
      },
    });

    return createSuccessResponse({
      constraint: {
        id: preference.id,
        payload: {
          source: preference.source,
          content: preference.content,
          category: preference.category,
          type: 'user_preference',
          language: 'markdown',
          scope: 'project',
          project_id: projectId
        }
      },
      message: 'Constraint updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating project constraint:', error);
    if (error.code === 'P2025') {
      return createNotFoundError('Constraint not found');
    }
    return createErrorResponse('Failed to update constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// DELETE - Remove project constraint
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();
    const { source } = body;

    if (!source) {
      return createErrorResponse('Source is required', HTTP_STATUS.BAD_REQUEST);
    }

    await prisma.projectPreference.delete({
      where: {
        projectId_source: {
          projectId,
          source
        }
      }
    });

    return createSuccessResponse({
      success: true,
      message: 'Constraint deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting project constraint:', error);
    if (error.code === 'P2025') {
      return createNotFoundError('Constraint not found');
    }
    return createErrorResponse('Failed to delete constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}