import { NextResponse } from 'next/server';

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type JsonRpcError = {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
};

export type JsonRpcSuccess<T> = {
  jsonrpc: '2.0';
  result: T;
  id: string | number | null;
};

// Standard HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// JSON-RPC error codes
export const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom application errors
  AUTHENTICATION_FAILED: -32000,
  AUTHORIZATION_FAILED: -32001,
  RESOURCE_NOT_FOUND: -32002,
  VALIDATION_FAILED: -32003,
  RATE_LIMIT_EXCEEDED: -32004,
} as const;

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  }, { status });
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  data?: any
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error,
    ...(data && { data }),
  }, { status });
}

/**
 * Create JSON-RPC success response
 */
export function createJsonRpcSuccess<T>(
  result: T,
  id: string | number | null
): NextResponse<JsonRpcSuccess<T>> {
  return NextResponse.json({
    jsonrpc: '2.0',
    result,
    id,
  });
}

/**
 * Create JSON-RPC error response
 */
export function createJsonRpcError(
  code: number,
  message: string,
  id: string | number | null,
  data?: any
): NextResponse<JsonRpcError> {
  return NextResponse.json({
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data && { data }),
    },
    id,
  });
}

/**
 * Create validation error response
 */
export function createValidationError(
  message: string,
  details?: any
): NextResponse<ApiResponse> {
  return createErrorResponse(
    message,
    HTTP_STATUS.BAD_REQUEST,
    details
  );
}

/**
 * Create not found error response
 */
export function createNotFoundError(
  resource: string
): NextResponse<ApiResponse> {
  return createErrorResponse(
    `${resource} not found`,
    HTTP_STATUS.NOT_FOUND
  );
}

/**
 * Create unauthorized error response
 */
export function createUnauthorizedError(
  message: string = 'Authentication required'
): NextResponse<ApiResponse> {
  return createErrorResponse(
    message,
    HTTP_STATUS.UNAUTHORIZED
  );
}

/**
 * Create conflict error response
 */
export function createConflictError(
  message: string
): NextResponse<ApiResponse> {
  return createErrorResponse(
    message,
    HTTP_STATUS.CONFLICT
  );
}