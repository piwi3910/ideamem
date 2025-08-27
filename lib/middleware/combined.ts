import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withValidation, ValidationConfig } from './validation';
import { withErrorHandling, ErrorContext } from './error-handler';

/**
 * Combined configuration for validation and error handling
 */
export type CombinedConfig<T extends ValidationConfig = ValidationConfig> = {
  validation?: T;
  errorContext?: ErrorContext;
};

/**
 * Type-safe handler with both validation and error handling
 */
export type CombinedHandler<T extends ValidationConfig> = (
  request: NextRequest,
  validated: {
    body?: T['body'] extends z.ZodSchema ? z.infer<T['body']> : never;
    query?: T['query'] extends z.ZodSchema ? z.infer<T['query']> : never;
    params?: T['params'] extends z.ZodSchema ? z.infer<T['params']> : never;
    headers?: T['headers'] extends z.ZodSchema ? z.infer<T['headers']> : never;
  }
) => Promise<NextResponse> | NextResponse;

/**
 * Combine withValidation and withErrorHandling middlewares
 * Provides both request validation and automatic error handling
 */
export function withMiddleware<T extends ValidationConfig>(
  config: CombinedConfig<T>,
  handler: CombinedHandler<T>
) {
  // Apply validation first, then error handling
  const validatedHandler = config.validation
    ? withValidation(config.validation, handler as any)
    : handler;

  // Wrap with error handling
  return withErrorHandling(validatedHandler as any, config.errorContext || {});
}

/**
 * Pre-configured middleware combinations for common operations
 */
export const Middleware = {
  /**
   * CRUD operations with validation and error handling
   */
  crud: <T extends ValidationConfig>(
    resource: string,
    operation: 'create' | 'update' | 'delete' | 'find',
    validation?: T,
    handler?: CombinedHandler<T>
  ) => {
    if (!handler) {
      // Return a function that takes the handler (for use with decorators)
      return (h: CombinedHandler<T>) =>
        withMiddleware(
          {
            validation,
            errorContext: { resource, operation },
          },
          h
        );
    }
    return withMiddleware(
      {
        validation,
        errorContext: { resource, operation },
      },
      handler
    );
  },

  /**
   * API endpoints with validation and error handling
   */
  api: <T extends ValidationConfig>(
    validation?: T,
    errorContext?: ErrorContext
  ) => {
    return (handler: CombinedHandler<T>) =>
      withMiddleware({ validation, errorContext }, handler);
  },

  /**
   * Project-scoped operations
   */
  project: <T extends ValidationConfig>(
    projectId: string,
    validation?: T,
    operation?: ErrorContext['operation']
  ) => {
    return (handler: CombinedHandler<T>) =>
      withMiddleware(
        {
          validation,
          errorContext: { projectId, operation },
        },
        handler
      );
  },

  /**
   * Admin operations (no validation by default, just error handling)
   */
  admin: <T extends ValidationConfig>(
    resource: string,
    validation?: T
  ) => {
    return (handler: CombinedHandler<T>) =>
      withMiddleware(
        {
          validation,
          errorContext: { resource, operation: 'find' },
        },
        handler
      );
  },
};

/**
 * Export convenience functions for common patterns
 */
export const GET = {
  /**
   * Simple GET endpoint with error handling
   */
  simple: (handler: (request: NextRequest) => Promise<NextResponse>) =>
    withErrorHandling(handler as any, {}),

  /**
   * GET with query validation
   */
  withQuery: <T extends z.ZodSchema>(
    querySchema: T,
    handler: (request: NextRequest, query: z.infer<T>) => Promise<NextResponse>
  ) =>
    withMiddleware(
      { validation: { query: querySchema } },
      handler as any
    ),

  /**
   * GET with params validation
   */
  withParams: <T extends z.ZodSchema>(
    paramsSchema: T,
    handler: (request: NextRequest, params: z.infer<T>) => Promise<NextResponse>
  ) =>
    withMiddleware(
      { validation: { params: paramsSchema } },
      handler as any
    ),
};

export const POST = {
  /**
   * POST with body validation
   */
  withBody: <T extends z.ZodSchema>(
    bodySchema: T,
    handler: (request: NextRequest, body: z.infer<T>) => Promise<NextResponse>
  ) =>
    withMiddleware(
      { validation: { body: bodySchema } },
      handler as any
    ),

  /**
   * POST with body and params validation
   */
  withBodyAndParams: <B extends z.ZodSchema, P extends z.ZodSchema>(
    bodySchema: B,
    paramsSchema: P,
    handler: (
      request: NextRequest,
      body: z.infer<B>,
      params: z.infer<P>
    ) => Promise<NextResponse>
  ) =>
    withMiddleware(
      { validation: { body: bodySchema, params: paramsSchema } },
      handler as any
    ),
};

export const PUT = POST; // PUT uses same patterns as POST
export const PATCH = POST; // PATCH uses same patterns as POST

export const DELETE = {
  /**
   * DELETE with params validation
   */
  withParams: <T extends z.ZodSchema>(
    paramsSchema: T,
    handler: (request: NextRequest, params: z.infer<T>) => Promise<NextResponse>
  ) =>
    withMiddleware(
      { validation: { params: paramsSchema } },
      handler as any
    ),
};