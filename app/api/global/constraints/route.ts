import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';

// Unified API for all global constraints (all categories under preferences)
export async function GET() {
  try {
    const preferences = await prisma.globalPreference.findMany({
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
        scope: 'global',
        project_id: 'global'
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
    console.error('Error fetching global constraints:', error);
    return createErrorResponse('Failed to fetch global constraints', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// POST - Add new global constraint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, content, category } = body;

    if (!source || !content) {
      return createErrorResponse('Source and content are required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!['rule', 'tooling', 'workflow', 'formatting'].includes(category)) {
      return createErrorResponse('Category must be one of: rule, tooling, workflow, formatting', HTTP_STATUS.BAD_REQUEST);
    }

    const preference = await prisma.globalPreference.create({
      data: {
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
            scope: 'global',
            project_id: 'global'
          }
        },
        message: 'Constraint added successfully'
      },
      'Constraint added successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error: any) {
    console.error('Error adding global constraint:', error);
    if (error.code === 'P2002') {
      return createErrorResponse('A constraint with this source already exists', HTTP_STATUS.CONFLICT);
    }
    return createErrorResponse('Failed to add constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// PUT - Update existing global constraint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, content, category } = body;

    if (!source || !content) {
      return createErrorResponse('Source and content are required', HTTP_STATUS.BAD_REQUEST);
    }

    if (category && !['rule', 'tooling', 'workflow', 'formatting'].includes(category)) {
      return createErrorResponse('Category must be one of: rule, tooling, workflow, formatting', HTTP_STATUS.BAD_REQUEST);
    }

    const preference = await prisma.globalPreference.update({
      where: { source },
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
          scope: 'global',
          project_id: 'global'
        }
      },
      message: 'Constraint updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating global constraint:', error);
    if (error.code === 'P2025') {
      return createNotFoundError('Constraint not found');
    }
    return createErrorResponse('Failed to update constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// DELETE - Remove global constraint
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { source } = body;

    if (!source) {
      return createErrorResponse('Source is required', HTTP_STATUS.BAD_REQUEST);
    }

    await prisma.globalPreference.delete({
      where: { source }
    });

    return createSuccessResponse({
      success: true,
      message: 'Constraint deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting global constraint:', error);
    if (error.code === 'P2025') {
      return createNotFoundError('Constraint not found');
    }
    return createErrorResponse('Failed to delete constraint', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}