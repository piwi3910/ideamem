/**
 * Generic API client for frontend data fetching
 * Provides centralized error handling, type safety, and request configuration
 */

export interface ApiClientOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  data?: any;
}

export class ApiClientError extends Error implements ApiError {
  status?: number;
  statusText?: string;
  data?: any;

  constructor(message: string, status?: number, statusText?: string, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/**
 * Generic fetch wrapper with error handling and retry logic
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const makeRequest = async (attempt = 0): Promise<T> => {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }

        throw new ApiClientError(
          errorData?.error || errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          response.statusText,
          errorData
        );
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      
      // Return text for non-JSON responses
      return await response.text() as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError(`Request timeout after ${timeout}ms`, 408, 'Request Timeout');
      }

      // Retry logic for network errors
      if (attempt < retries && error instanceof Error && !error.message.includes('4')) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        return makeRequest(attempt + 1);
      }

      // Re-throw API errors
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Wrap other errors
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500,
        'Internal Error'
      );
    }
  };

  return makeRequest();
}

/**
 * Pre-configured API client methods
 */
export const api = {
  get: <T = any>(url: string, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, data?: any, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(url: string, data?: any, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = any>(url: string, data?: any, options?: Omit<ApiClientOptions, 'method' | 'body'>) =>
    apiClient<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(url: string, options?: Omit<ApiClientOptions, 'method'>) =>
    apiClient<T>(url, { ...options, method: 'DELETE' }),
};

/**
 * React Query integration helper
 */
export function createQueryFn<T = any>(
  endpoint: string,
  options?: Omit<ApiClientOptions, 'method'>
) {
  return async () => {
    const data = await api.get<T>(endpoint, options);
    return data;
  };
}

/**
 * React Query mutation helper
 */
export function createMutationFn<TData = any, TVariables = any>(
  endpoint: string | ((variables: TVariables) => string),
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  return async (variables: TVariables) => {
    const url = typeof endpoint === 'function' ? endpoint(variables) : endpoint;
    
    switch (method) {
      case 'DELETE':
        return api.delete<TData>(url);
      case 'PUT':
        return api.put<TData>(url, variables);
      case 'PATCH':
        return api.patch<TData>(url, variables);
      case 'POST':
      default:
        return api.post<TData>(url, variables);
    }
  };
}