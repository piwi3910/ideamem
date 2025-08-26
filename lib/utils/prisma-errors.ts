import { PrismaClientKnownRequestError } from '@/lib/generated/prisma/runtime/library';
import { NextResponse } from 'next/server';
import { createErrorResponse, createConflictError, createNotFoundError, HTTP_STATUS } from './responses';

export type PrismaErrorCode = 
  | 'P2002' // Unique constraint violation
  | 'P2025' // Record not found
  | 'P2003' // Foreign key constraint violation
  | 'P2014' // Required relation violation
  | 'P2023' // Inconsistent column data
  | 'P2024'; // Timed out operation

/**
 * Map Prisma error codes to user-friendly messages and HTTP status codes
 */
const PRISMA_ERROR_MAP: Record<PrismaErrorCode, { message: string; status: number }> = {
  P2002: {
    message: 'A record with this information already exists',
    status: HTTP_STATUS.CONFLICT,
  },
  P2025: {
    message: 'Record not found',
    status: HTTP_STATUS.NOT_FOUND,
  },
  P2003: {
    message: 'Invalid reference to related record',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  P2014: {
    message: 'Required field is missing',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  P2023: {
    message: 'Invalid data format',
    status: HTTP_STATUS.BAD_REQUEST,
  },
  P2024: {
    message: 'Operation timed out - please try again',
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
  },
};

/**
 * Check if error is a known Prisma error
 */
export function isPrismaError(error: any): error is PrismaClientKnownRequestError {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

/**
 * Handle Prisma errors with contextual messages
 */
export function handlePrismaError(
  error: any,
  context: {
    resource?: string;
    operation?: 'create' | 'update' | 'delete' | 'find';
    customMessages?: Partial<Record<PrismaErrorCode, string>>;
  } = {}
): NextResponse {
  console.error('Prisma error:', error);

  if (isPrismaError(error)) {
    const errorCode = error.code as PrismaErrorCode;
    const customMessage = context.customMessages?.[errorCode];
    const defaultMapping = PRISMA_ERROR_MAP[errorCode];

    if (customMessage || defaultMapping) {
      const message = customMessage || defaultMapping.message;
      const status = defaultMapping?.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

      // Add contextual information
      let contextualMessage = message;
      if (context.resource && context.operation) {
        switch (errorCode) {
          case 'P2002':
            contextualMessage = `A ${context.resource} with this information already exists`;
            break;
          case 'P2025':
            contextualMessage = `${context.resource} not found`;
            break;
          default:
            contextualMessage = `Failed to ${context.operation} ${context.resource}: ${message}`;
        }
      }

      return createErrorResponse(contextualMessage, status, {
        code: errorCode,
        operation: context.operation,
        resource: context.resource,
      });
    }
  }

  // Generic database error
  const operation = context.operation ? ` ${context.operation}` : '';
  const resource = context.resource ? ` ${context.resource}` : '';
  
  return createErrorResponse(
    `Database error during${operation}${resource} operation`,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    {
      originalError: error.message,
    }
  );
}

/**
 * Specialized handlers for common operations
 */
export const PrismaErrorHandlers = {
  /**
   * Handle errors for creation operations
   */
  create: (error: any, resource: string, customMessages?: Partial<Record<PrismaErrorCode, string>>) =>
    handlePrismaError(error, { resource, operation: 'create', customMessages }),

  /**
   * Handle errors for update operations
   */
  update: (error: any, resource: string, customMessages?: Partial<Record<PrismaErrorCode, string>>) =>
    handlePrismaError(error, { resource, operation: 'update', customMessages }),

  /**
   * Handle errors for delete operations
   */
  delete: (error: any, resource: string, customMessages?: Partial<Record<PrismaErrorCode, string>>) =>
    handlePrismaError(error, { resource, operation: 'delete', customMessages }),

  /**
   * Handle errors for find operations
   */
  find: (error: any, resource: string, customMessages?: Partial<Record<PrismaErrorCode, string>>) =>
    handlePrismaError(error, { resource, operation: 'find', customMessages }),
};

/**
 * Create contextual error messages for preferences/rules
 */
export function createPreferenceErrorMessages(scope: 'global' | 'project') {
  const prefix = scope === 'global' ? 'global' : 'project';
  
  return {
    P2002: `A ${prefix} preference with this source already exists`,
    P2025: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} preference not found`,
  } as const;
}

export function createRuleErrorMessages(scope: 'global' | 'project') {
  const prefix = scope === 'global' ? 'global' : 'project';
  
  return {
    P2002: `A ${prefix} rule with this source already exists`,
    P2025: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} rule not found`,
  } as const;
}