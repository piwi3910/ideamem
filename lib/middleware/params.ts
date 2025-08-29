import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { createValidationError } from '@/lib/utils/responses';

export type RouteParams = {
  [key: string]: string | string[];
};

export type ExtractedParams<T extends ZodSchema> = z.infer<T>;

export type ParamHandler<T extends ZodSchema> = (
  request: NextRequest,
  params: ExtractedParams<T>,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Middleware to extract and validate route parameters
 */
export function withParams<T extends ZodSchema>(
  schema: T,
  handler: ParamHandler<T>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    try {
      // Extract params from route context
      const rawParams = routeContext?.params ? await routeContext.params : {};
      
      // Validate params with schema
      const result = schema.safeParse(rawParams);
      
      if (!result.success) {
        return createValidationError('Invalid route parameters', {
          issues: result.error.issues,
        });
      }

      return handler(request, result.data, routeContext);
    } catch (error: any) {
      console.error('Parameter extraction error:', error);
      return createValidationError('Failed to process route parameters');
    }
  };
}

/**
 * Common parameter schemas
 */
export const ParamSchemas = {
  // UUID parameter (e.g., /api/projects/[id])
  uuid: z.object({
    id: z.string().uuid('Invalid UUID format'),
  }),

  // Project ID parameter
  projectId: z.object({
    id: z.string().uuid('Invalid project ID format'),
  }),

  // Optional UUID parameter
  optionalUuid: z.object({
    id: z.string().uuid('Invalid UUID format').optional(),
  }),

  // Slug parameter (e.g., /api/docs/[slug])
  slug: z.object({
    slug: z.string().min(1, 'Slug is required'),
  }),

  // Multiple segments (e.g., /api/docs/[...segments])
  segments: z.object({
    segments: z.array(z.string()).min(1, 'At least one segment is required'),
  }),

  // Combination of project ID and resource ID
  projectResource: z.object({
    id: z.string().uuid('Invalid project ID format'),
    resourceId: z.string().uuid('Invalid resource ID format'),
  }),
};

/**
 * Pre-configured parameter middleware
 */
export const ParamMiddleware = {
  /**
   * Extract UUID parameter
   */
  withUuid: <T extends Omit<any, 'id'>>(
    handler: ParamHandler<typeof ParamSchemas.uuid>
  ) => withParams(ParamSchemas.uuid, handler),

  /**
   * Extract project ID parameter
   */
  withProjectId: <T extends Omit<any, 'id'>>(
    handler: ParamHandler<typeof ParamSchemas.projectId>
  ) => withParams(ParamSchemas.projectId, handler),

  /**
   * Extract optional UUID parameter
   */
  withOptionalUuid: <T>(
    handler: ParamHandler<typeof ParamSchemas.optionalUuid>
  ) => withParams(ParamSchemas.optionalUuid, handler),

  /**
   * Extract slug parameter
   */
  withSlug: <T extends Omit<any, 'slug'>>(
    handler: ParamHandler<typeof ParamSchemas.slug>
  ) => withParams(ParamSchemas.slug, handler),
};

/**
 * Helper to extract params without validation (for simple use cases)
 */
export async function extractParams(routeContext?: any): Promise<RouteParams> {
  return routeContext?.params ? await routeContext.params : {};
}

/**
 * Helper to get a specific parameter with type safety
 */
export async function getParam<T = string>(
  routeContext: any,
  key: string,
  transform?: (value: string) => T
): Promise<T | null> {
  const params = await extractParams(routeContext);
  const value = params[key];
  
  if (!value || typeof value !== 'string') {
    return null;
  }
  
  return transform ? transform(value) : (value as unknown as T);
}

/**
 * Helper to get UUID parameter with validation
 */
export async function getUuidParam(
  routeContext: any,
  key: string = 'id'
): Promise<string | null> {
  const value = await getParam(routeContext, key);
  
  if (!value) return null;
  
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  return uuidRegex.test(value) ? value : null;
}

/**
 * Helper to get project ID parameter
 */
export async function getProjectId(routeContext: any): Promise<string | null> {
  return getUuidParam(routeContext, 'id');
}

/**
 * Combine parameter extraction with other middleware patterns
 */
export const ParamPatterns = {
  /**
   * Extract UUID param and pass to handler
   */
  uuid: <T>(handler: (request: NextRequest, id: string, context?: T) => Promise<NextResponse>) => 
    withParams(ParamSchemas.uuid, async (request, params, context) => {
      return handler(request, params.id, context);
    }),

  /**
   * Extract project ID param and pass to handler
   */
  projectId: <T>(handler: (request: NextRequest, projectId: string, context?: T) => Promise<NextResponse>) => 
    withParams(ParamSchemas.projectId, async (request, params, context) => {
      return handler(request, params.id, context);
    }),

  /**
   * Extract multiple params and pass as object
   */
  multiple: <T extends ZodSchema>(schema: T, handler: (request: NextRequest, params: z.infer<T>, context?: any) => Promise<NextResponse>) => 
    withParams(schema, handler),
};

/**
 * Create middleware that validates specific parameter patterns
 */
export function createParamValidator<T extends ZodSchema>(schema: T) {
  return (handler: ParamHandler<T>) => withParams(schema, handler);
}

/**
 * Utility to build parameter schema from route patterns
 */
export function buildParamSchema(routePattern: string): ZodSchema {
  const segments = routePattern.split('/').filter(segment => 
    segment.startsWith('[') && segment.endsWith(']')
  );
  
  const schemaObject: Record<string, ZodSchema> = {};
  
  for (const segment of segments) {
    const paramName = segment.slice(1, -1); // Remove [ and ]
    
    if (paramName === 'id' || paramName.endsWith('Id')) {
      schemaObject[paramName] = z.string().uuid(`Invalid ${paramName} format`);
    } else {
      schemaObject[paramName] = z.string().min(1, `${paramName} is required`);
    }
  }
  
  return z.object(schemaObject);
}