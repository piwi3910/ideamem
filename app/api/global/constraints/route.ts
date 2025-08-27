import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { withValidation } from '@/lib/middleware/validation';
import { MiddlewareStacks } from '@/lib/middleware/compose';

// Define schemas for validation
const constraintCategoryEnum = z.enum(['rule', 'tooling', 'workflow', 'formatting']);

const createConstraintSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  content: z.string().min(1, 'Content is required'),
  category: constraintCategoryEnum,
});

const updateConstraintSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  content: z.string().min(1, 'Content is required'),
  category: constraintCategoryEnum.optional(),
});

const deleteConstraintSchema = z.object({
  source: z.string().min(1, 'Source is required'),
});

// Unified API for all global constraints (all categories under preferences)
export const GET = MiddlewareStacks.api(async (request: NextRequest) => {
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
});

// POST - Add new global constraint
export const POST = withValidation(
  { body: createConstraintSchema },
  async (_request: NextRequest, { body: { source, content, category } }: { body: z.infer<typeof createConstraintSchema> }) => {
    const preference = await prisma.globalPreference.create({
      data: {
        source,
        content,
        category: category || 'rule'
      },
    }).catch((error: { code?: string }) => {
      console.error('Error adding global constraint:', error);
      if (error.code === 'P2002') {
        throw new Error('A constraint with this source already exists');
      }
      throw error;
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
  }
);

// PUT - Update existing global constraint
export const PUT = withValidation(
  { body: updateConstraintSchema },
  async (_request: NextRequest, { body: { source, content, category } }: { body: z.infer<typeof updateConstraintSchema> }) => {
    const preference = await prisma.globalPreference.update({
      where: { source },
      data: { 
        content,
        ...(category && { category })
      },
    }).catch((error: { code?: string }) => {
      console.error('Error updating global constraint:', error);
      if (error.code === 'P2025') {
        throw new Error('Constraint not found');
      }
      throw error;
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
  }
);

// DELETE - Remove global constraint
export const DELETE = withValidation(
  { body: deleteConstraintSchema },
  async (_request: NextRequest, { body: { source } }: { body: z.infer<typeof deleteConstraintSchema> }) => {
    await prisma.globalPreference.delete({
      where: { source }
    }).catch((error: { code?: string }) => {
      console.error('Error deleting global constraint:', error);
      if (error.code === 'P2025') {
        throw new Error('Constraint not found');
      }
      throw error;
    });

    return createSuccessResponse({
      success: true,
      message: 'Constraint deleted successfully'
    });
  }
);