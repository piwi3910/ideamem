import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { withValidation } from '@/lib/middleware/validation';

// Define schemas
const paramsSchema = z.object({
  id: z.string(),
});

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

// Unified API for all project constraints (all categories under preferences)
export const GET = withValidation(
  { params: paramsSchema },
  async (_request: NextRequest, { params: { id: projectId } }) => {
    try {
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
);

// POST - Add new project constraint
export const POST = withValidation(
  { params: paramsSchema, body: createConstraintSchema },
  async (_request: NextRequest, { params: { id: projectId }, body: { source, content, category } }) => {
    try {
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
);

// PUT - Update existing project constraint
export const PUT = withValidation(
  { params: paramsSchema, body: updateConstraintSchema },
  async (_request: NextRequest, { params: { id: projectId }, body: { source, content, category } }) => {
    try {
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
);

// DELETE - Remove project constraint
export const DELETE = withValidation(
  { params: paramsSchema, body: deleteConstraintSchema },
  async (_request: NextRequest, { params: { id: projectId }, body: { source } }) => {
    try {
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
);