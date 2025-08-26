import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { createValidationError } from '@/lib/utils/responses';

export type ValidationSchemas = {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
};

export type ValidatedRequest<T extends ValidationSchemas> = {
  body: T['body'] extends ZodSchema ? z.infer<T['body']> : any;
  query: T['query'] extends ZodSchema ? z.infer<T['query']> : any;
  params: T['params'] extends ZodSchema ? z.infer<T['params']> : any;
  headers: T['headers'] extends ZodSchema ? z.infer<T['headers']> : any;
};

export type ValidatedRouteHandler<T extends ValidationSchemas> = (
  request: NextRequest,
  validated: ValidatedRequest<T>,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Middleware to validate request data using Zod schemas
 */
export function withValidation<T extends ValidationSchemas>(
  schemas: T,
  handler: ValidatedRouteHandler<T>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      const validated: any = {};

      // Validate request body
      if (schemas.body) {
        let body;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch (error) {
          return createValidationError('Invalid JSON in request body');
        }
        
        const result = schemas.body.safeParse(body);
        if (!result.success) {
          return createValidationError('Invalid request body', {
            issues: result.error.issues,
          });
        }
        validated.body = result.data;
      }

      // Validate query parameters
      if (schemas.query) {
        const url = new URL(request.url);
        const query = Object.fromEntries(url.searchParams.entries());
        
        const result = schemas.query.safeParse(query);
        if (!result.success) {
          return createValidationError('Invalid query parameters', {
            issues: result.error.issues,
          });
        }
        validated.query = result.data;
      }

      // Validate route parameters
      if (schemas.params && routeContext?.params) {
        const params = await routeContext.params;
        const result = schemas.params.safeParse(params);
        if (!result.success) {
          return createValidationError('Invalid route parameters', {
            issues: result.error.issues,
          });
        }
        validated.params = result.data;
      }

      // Validate headers
      if (schemas.headers) {
        const headers = Object.fromEntries(request.headers.entries());
        const result = schemas.headers.safeParse(headers);
        if (!result.success) {
          return createValidationError('Invalid headers', {
            issues: result.error.issues,
          });
        }
        validated.headers = result.data;
      }

      return handler(request, validated, routeContext);
    } catch (error) {
      if (error instanceof ZodError) {
        return createValidationError('Validation failed', {
          issues: error.issues,
        });
      }
      
      throw error; // Re-throw non-validation errors
    }
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // UUID parameter validation
  uuidParam: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),

  // Pagination query validation
  pagination: z.object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(10),
    offset: z.coerce.number().min(0).optional(),
  }),

  // Search query validation
  search: z.object({
    q: z.string().min(1, 'Search query is required'),
    type: z.enum(['code', 'documentation', 'conversation', 'user_preference', 'rule']).optional(),
    language: z.string().optional(),
    source: z.string().optional(),
  }),

  // Preference/Rule body validation
  preferenceBody: z.object({
    source: z.string().min(1, 'Source is required'),
    content: z.string().min(1, 'Content is required'),
  }),

  ruleBody: z.object({
    source: z.string().min(1, 'Source is required'),
    content: z.string().min(1, 'Content is required'),
  }),

  // Project body validation
  projectBody: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    gitRepo: z.string().url('Invalid Git repository URL'),
  }),

  // Content ingestion body validation
  contentBody: z.object({
    content: z.string().min(1, 'Content is required'),
    source: z.string().min(1, 'Source is required'),
    type: z.enum(['code', 'documentation', 'conversation', 'user_preference', 'rule']),
    language: z.string().min(1, 'Language is required'),
  }),

  // Health check body validation
  healthCheckBody: z.object({
    service: z.enum(['qdrant', 'ollama', 'ollama-embedding']),
  }),

  // Authorization header validation
  authHeader: z.object({
    authorization: z.string().regex(/^Bearer\s+.+$/, 'Invalid authorization header format'),
  }),
};

/**
 * Pre-configured validation middleware for common patterns
 */
export const ValidationMiddleware = {
  /**
   * Validate UUID parameter
   */
  withUuidParam: <T extends Omit<ValidationSchemas, 'params'>>(
    handler: ValidatedRouteHandler<T & { params: typeof CommonSchemas.uuidParam }>,
    schemas?: T
  ) =>
    withValidation(
      { params: CommonSchemas.uuidParam, ...schemas },
      handler
    ),

  /**
   * Validate pagination query
   */
  withPagination: <T extends Omit<ValidationSchemas, 'query'>>(
    handler: ValidatedRouteHandler<T & { query: typeof CommonSchemas.pagination }>,
    schemas?: T
  ) =>
    withValidation(
      { query: CommonSchemas.pagination, ...schemas },
      handler
    ),

  /**
   * Validate search query
   */
  withSearch: <T extends Omit<ValidationSchemas, 'query'>>(
    handler: ValidatedRouteHandler<T & { query: typeof CommonSchemas.search }>,
    schemas?: T
  ) =>
    withValidation(
      { query: CommonSchemas.search, ...schemas },
      handler
    ),

  /**
   * Validate preference body
   */
  withPreferenceBody: <T extends Omit<ValidationSchemas, 'body'>>(
    handler: ValidatedRouteHandler<T & { body: typeof CommonSchemas.preferenceBody }>,
    schemas?: T
  ) =>
    withValidation(
      { body: CommonSchemas.preferenceBody, ...schemas },
      handler
    ),

  /**
   * Validate rule body
   */
  withRuleBody: <T extends Omit<ValidationSchemas, 'body'>>(
    handler: ValidatedRouteHandler<T & { body: typeof CommonSchemas.ruleBody }>,
    schemas?: T
  ) =>
    withValidation(
      { body: CommonSchemas.ruleBody, ...schemas },
      handler
    ),

  /**
   * Validate authorization header
   */
  withAuthHeader: <T extends Omit<ValidationSchemas, 'headers'>>(
    handler: ValidatedRouteHandler<T & { headers: typeof CommonSchemas.authHeader }>,
    schemas?: T
  ) =>
    withValidation(
      { headers: CommonSchemas.authHeader, ...schemas },
      handler
    ),
};

/**
 * Create custom validation middleware for specific use cases
 */
export function createValidationMiddleware<T extends ValidationSchemas>(schemas: T) {
  return (handler: ValidatedRouteHandler<T>) =>
    withValidation(schemas, handler);
}

/**
 * Combine validation with specific patterns
 */
export const ValidationPatterns = {
  /**
   * Validate CRUD operations with UUID param
   */
  crudWithUuid: (bodySchema: ZodSchema) =>
    createValidationMiddleware({
      params: CommonSchemas.uuidParam,
      body: bodySchema,
    }),

  /**
   * Validate paginated list operations
   */
  paginatedList: (querySchema?: ZodSchema) =>
    createValidationMiddleware({
      query: querySchema ? z.object({}).merge(querySchema as any).merge(CommonSchemas.pagination) : CommonSchemas.pagination,
    }),

  /**
   * Validate authenticated operations
   */
  authenticated: (bodySchema?: ZodSchema, querySchema?: ZodSchema) =>
    createValidationMiddleware({
      headers: CommonSchemas.authHeader,
      ...(bodySchema && { body: bodySchema }),
      ...(querySchema && { query: querySchema }),
    }),
};