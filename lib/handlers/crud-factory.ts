import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { createSuccessResponse, createNotFoundError, createErrorResponse, HTTP_STATUS } from '@/lib/utils/responses';
import { PrismaErrorHandlers, createPreferenceErrorMessages, createRuleErrorMessages } from '@/lib/utils/prisma-errors';

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
        type: this.config.resourceName.includes('preference') ? 'user_preference' : 'rule',
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
    return this.config.resourceName.includes('preference') ? 'preferences' : 'rules';
  }

  /**
   * Get singular name for responses
   */
  private getSingularName(): string {
    return this.config.resourceName.includes('preference') ? 'preference' : 'rule';
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
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
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
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
    }),
    customErrorMessages: createPreferenceErrorMessages('project'),
  }),

  /**
   * Global rules CRUD handler
   */
  globalRules: new CrudHandlerFactory({
    scope: 'global',
    resourceName: 'global rule',
    model: prisma.globalRule,
    createData: (input: CrudItemInput) => ({
      source: input.source,
      content: input.content,
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
    }),
    customErrorMessages: createRuleErrorMessages('global'),
  }),

  /**
   * Project rules CRUD handler
   */
  projectRules: new CrudHandlerFactory({
    scope: 'project',
    resourceName: 'project rule',
    model: prisma.projectRule,
    createData: (input: CrudItemInput, projectId?: string) => ({
      projectId: projectId!,
      source: input.source,
      content: input.content,
    }),
    updateData: (input: CrudItemUpdate) => ({
      ...(input.content && { content: input.content }),
    }),
    customErrorMessages: createRuleErrorMessages('project'),
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
    GET: async (request: NextRequest, context?: { params?: Promise<{ id?: string }> }) => {
      const projectId = context?.params ? (await context.params).id : undefined;
      return handler.list(projectId);
    },

    /**
     * POST handler
     */
    POST: async (request: NextRequest, context?: { params?: Promise<{ id?: string }> }) => {
      try {
        const body = await request.json();
        const projectId = context?.params ? (await context.params).id : undefined;
        return handler.create(body, projectId);
      } catch (error) {
        return createErrorResponse('Invalid JSON body', HTTP_STATUS.BAD_REQUEST);
      }
    },

    /**
     * PUT handler
     */
    PUT: async (request: NextRequest, context?: { params?: Promise<{ id?: string }> }) => {
      try {
        const body = await request.json();
        const { source, ...updateData } = body;
        
        if (!source) {
          return createErrorResponse('Source is required', HTTP_STATUS.BAD_REQUEST);
        }

        const projectId = context?.params ? (await context.params).id : undefined;
        return handler.update(source, updateData, projectId);
      } catch (error) {
        return createErrorResponse('Invalid JSON body', HTTP_STATUS.BAD_REQUEST);
      }
    },

    /**
     * DELETE handler
     */
    DELETE: async (request: NextRequest, context?: { params?: Promise<{ id?: string }> }) => {
      const { searchParams } = new URL(request.url);
      const source = searchParams.get('source');
      
      if (!source) {
        return createErrorResponse('Source parameter is required', HTTP_STATUS.BAD_REQUEST);
      }

      const projectId = context?.params ? (await context.params).id : undefined;
      return handler.delete(source, projectId);
    },
  };
}

/**
 * Pre-configured route handlers
 */
export const PreConfiguredRoutes = {
  globalPreferences: createCrudRoutes(CrudHandlers.globalPreferences),
  projectPreferences: createCrudRoutes(CrudHandlers.projectPreferences),
  globalRules: createCrudRoutes(CrudHandlers.globalRules),
  projectRules: createCrudRoutes(CrudHandlers.projectRules),
};