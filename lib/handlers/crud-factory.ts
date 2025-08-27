import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { PrismaErrorHandlers, createPreferenceErrorMessages } from '@/lib/utils/prisma-errors';
import { withValidation, CommonSchemas } from '@/lib/middleware/validation';

// Define Zod schemas for CRUD operations
const crudCreateSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().optional(),
});

const crudUpdateSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  content: z.string().optional(),
  category: z.string().optional(),
});

const crudDeleteQuerySchema = z.object({
  source: z.string().min(1, 'Source parameter is required'),
});

const crudParamsSchema = z.object({
  id: z.string().optional(),
});

export type CrudItem = {
  id: string;
  source: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CrudItemWithScope = CrudItem & {
  projectId?: string; // For project-scoped items
};

export type CrudItemInput = {
  source: string;
  content: string;
  category?: string;
};

export type CrudItemUpdate = Partial<CrudItemInput>;

export type CrudScope = 'global' | 'project';

export type CrudConfig<T = any> = {
  scope: CrudScope;
  resourceName: string;
  model: any; // Prisma model delegate
  whereClause?: (projectId?: string) => any;
  createData: (input: CrudItemInput, projectId?: string) => any;
  updateData: (input: CrudItemUpdate) => any;
  transformItem?: (item: any) => any;
  customErrorMessages?: {
    P2002?: string;
    P2025?: string;
  };
};

/**
 * Generic CRUD handler factory for preferences and rules
 */
export class CrudHandlerFactory<T extends CrudItem = CrudItem> {
  constructor(private config: CrudConfig<T>) {}

  /**
   * GET - List all items
   */
  async list(projectId?: string): Promise<NextResponse> {
    try {
      const whereClause = this.config.whereClause ? 
        this.config.whereClause(projectId) : 
        (projectId ? { projectId } : {});

      const items = await this.config.model.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
      });

      const transformedItems = items.map((item: any) => 
        this.config.transformItem ? this.config.transformItem(item) : this.transformToStandardFormat(item, projectId)
      );

      return createSuccessResponse({ [this.getCollectionName()]: transformedItems });
    } catch (error) {
      return PrismaErrorHandlers.find(error, this.config.resourceName, this.config.customErrorMessages);
    }
  }

  /**
   * GET - Get single item by source
   */
  async get(source: string, projectId?: string): Promise<NextResponse> {
    try {
      const whereClause = this.buildWhereClause(source, projectId);
      const item = await this.config.model.findUnique({ where: whereClause });

      if (!item) {
        return createNotFoundError(this.config.resourceName);
      }

      const transformedItem = this.config.transformItem ? 
        this.config.transformItem(item) : 
        this.transformToStandardFormat(item, projectId);

      return createSuccessResponse({ [this.getSingularName()]: transformedItem });
    } catch (error) {
      return PrismaErrorHandlers.find(error, this.config.resourceName, this.config.customErrorMessages);
    }
  }

  /**
   * POST - Create new item
   */
  async create(input: CrudItemInput, projectId?: string): Promise<NextResponse> {
    try {
      const data = this.config.createData(input, projectId);
      const item = await this.config.model.create({ data });

      const transformedItem = this.config.transformItem ? 
        this.config.transformItem(item) : 
        this.transformToStandardFormat(item, projectId);

      return createSuccessResponse(
        { 
          [this.getSingularName()]: transformedItem,
          message: `${this.config.resourceName} created successfully`,
        },
        `${this.config.resourceName} created successfully`,
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      return PrismaErrorHandlers.create(error, this.config.resourceName, this.config.customErrorMessages);
    }
  }

  /**
   * PUT - Update existing item
   */
  async update(source: string, input: CrudItemUpdate, projectId?: string): Promise<NextResponse> {
    try {
      const whereClause = this.buildWhereClause(source, projectId);
      const data = this.config.updateData(input);
      
      const item = await this.config.model.update({
        where: whereClause,
        data,
      });

      const transformedItem = this.config.transformItem ? 
        this.config.transformItem(item) : 
        this.transformToStandardFormat(item, projectId);

      return createSuccessResponse({
        [this.getSingularName()]: transformedItem,
        message: `${this.config.resourceName} updated successfully`,
      });
    } catch (error) {
      return PrismaErrorHandlers.update(error, this.config.resourceName, this.config.customErrorMessages);
    }
  }

  /**
   * DELETE - Remove item
   */
  async delete(source: string, projectId?: string): Promise<NextResponse> {
    try {
      const whereClause = this.buildWhereClause(source, projectId);
      await this.config.model.delete({ where: whereClause });

      return createSuccessResponse({
        success: true,
        message: `${this.config.resourceName} deleted successfully`,
      });
    } catch (error) {
      return PrismaErrorHandlers.delete(error, this.config.resourceName, this.config.customErrorMessages);
    }
  }

  /**
   * Build where clause for single item operations
   */
  private buildWhereClause(source: string, projectId?: string) {
    if (this.config.scope === 'project' && projectId) {
      return {
        projectId_source: {
          projectId,
          source,
        },
      };
    } else {
      return { source };
    }
  }

  /**
   * Transform item to standard format for frontend
   */
  private transformToStandardFormat(item: any, projectId?: string) {
    return {
      id: item.id,
      payload: {
        source: item.source,
        content: item.content,
        category: item.category,
        type: 'user_preference', // All constraints are now unified as preferences
        language: 'markdown',
        scope: this.config.scope,
        project_id: this.config.scope === 'project' ? projectId || item.projectId : 'global',
      },
    };
  }

  /**
   * Get collection name for responses
   */
  private getCollectionName(): string {
    return 'constraints'; // Unified naming for all constraint types
  }

  /**
   * Get singular name for responses
   */
  private getSingularName(): string {
    return 'constraint'; // Unified naming for all constraint types
  }
}

/**
 * Pre-configured CRUD handlers
 */
export const CrudHandlers = {
  /**
   * Global preferences CRUD handler
   */
  globalPreferences: new CrudHandlerFactory({
    scope: 'global',
    resourceName: 'global preference',
    model: prisma.globalPreference,
    createData: (input: CrudItemInput) => ({
      source: input.source,
      content: input.content,
      category: input.category || 'tooling',
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
      ...(input.category && { category: input.category }),
    }),
    customErrorMessages: createPreferenceErrorMessages('global'),
  }),

  /**
   * Project preferences CRUD handler
   */
  projectPreferences: new CrudHandlerFactory({
    scope: 'project',
    resourceName: 'project preference',
    model: prisma.projectPreference,
    createData: (input: CrudItemInput, projectId?: string) => ({
      projectId: projectId!,
      source: input.source,
      content: input.content,
      category: input.category || 'tooling',
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
      ...(input.category && { category: input.category }),
    }),
    customErrorMessages: createPreferenceErrorMessages('project'),
  }),

};

/**
 * Route handler factory that combines CRUD operations with middleware
 */
export function createCrudRoutes<T extends CrudItem>(handler: CrudHandlerFactory<T>) {
  return {
    /**
     * GET handler
     */
    GET: withValidation(
      { params: crudParamsSchema },
      async (_request: NextRequest, { params }, context) => {
        const projectId = params?.id;
        return handler.list(projectId);
      }
    ),

    /**
     * POST handler
     */
    POST: withValidation(
      { body: crudCreateSchema, params: crudParamsSchema },
      async (_request: NextRequest, { body, params }) => {
        const projectId = params?.id;
        return handler.create(body, projectId);
      }
    ),

    /**
     * PUT handler
     */
    PUT: withValidation(
      { body: crudUpdateSchema, params: crudParamsSchema },
      async (_request: NextRequest, { body, params }) => {
        const { source, ...updateData } = body;
        const projectId = params?.id;
        return handler.update(source, updateData, projectId);
      }
    ),

    /**
     * DELETE handler
     */
    DELETE: withValidation(
      { query: crudDeleteQuerySchema, params: crudParamsSchema },
      async (_request: NextRequest, { query, params }) => {
        const projectId = params?.id;
        return handler.delete(query.source, projectId);
      }
    ),
  };
}

/**
 * Pre-configured route handlers
 */
export const PreConfiguredRoutes = {
  globalPreferences: createCrudRoutes(CrudHandlers.globalPreferences),
  projectPreferences: createCrudRoutes(CrudHandlers.projectPreferences),
};