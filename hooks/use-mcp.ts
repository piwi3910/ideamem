import { useMutation, useQuery } from '@tanstack/react-query';

// Types
export interface McpRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpToolCall {
  name: string;
  arguments: any;
}

// Query keys
export const mcpKeys = {
  all: ['mcp'] as const,
  tools: () => [...mcpKeys.all, 'tools'] as const,
};

// API functions
async function callMcpApi(request: McpRequest): Promise<McpResponse> {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`MCP API request failed: ${response.statusText}`);
  }

  return response.json();
}

async function listMcpTools(): Promise<McpResponse> {
  return callMcpApi({
    jsonrpc: '2.0',
    id: Math.random().toString(36).substring(7),
    method: 'tools/list',
  });
}

async function callMcpTool(toolCall: McpToolCall): Promise<McpResponse> {
  return callMcpApi({
    jsonrpc: '2.0',
    id: Math.random().toString(36).substring(7),
    method: 'tools/call',
    params: toolCall,
  });
}

// Hooks
export function useMcpToolCall() {
  return useMutation({
    mutationFn: callMcpTool,
    // Don't retry failed tool calls as they might have side effects
    retry: false,
  });
}

export function useListMcpTools() {
  return useMutation({
    mutationFn: listMcpTools,
    retry: false,
  });
}

// Alternative query-based approach for tools listing (if you want to cache the result)
export function useMcpTools() {
  return useQuery({
    queryKey: mcpKeys.tools(),
    queryFn: listMcpTools,
    // Tools don't change frequently, so we can cache for a while
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Only fetch when explicitly requested
    enabled: false,
  });
}

// Generic MCP API call hook for other methods
export function useMcpApiCall() {
  return useMutation({
    mutationFn: callMcpApi,
    retry: false,
  });
}