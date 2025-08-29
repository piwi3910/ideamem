import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTool, getToolsList, registerTools } from './registry';
import { createToolContext } from './auth';
import { allTools } from './tools';
import { initializeDatabase } from '@/lib/database';

// Register all tools on module load
registerTools(allTools);

// MCP protocol schemas
const mcpRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional(),
});

/**
 * Create a JSON-RPC error response
 */
function createJsonRpcError(id: string | number, code: number, message: string, data?: any) {
  return {
    jsonrpc: '2.0' as const,
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Create a JSON-RPC success response
 */
function createJsonRpcSuccess(id: string | number, result: any) {
  return {
    jsonrpc: '2.0' as const,
    id,
    result,
  };
}

/**
 * Handle MCP initialize request
 */
async function handleInitialize(id: string | number) {
  return createJsonRpcSuccess(id, {
    protocolVersion: '0.1.0',
    serverInfo: {
      name: 'ideamem-mcp-server',
      version: '1.0.0',
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
  });
}

/**
 * Handle MCP tools/list request
 */
async function handleToolsList(id: string | number) {
  return createJsonRpcSuccess(id, {
    tools: getToolsList(),
  });
}

/**
 * Handle MCP tools/call request
 */
async function handleToolCall(id: string | number, params: any, request: NextRequest) {
  const { name, arguments: args } = params;
  
  const tool = getTool(name);
  if (!tool) {
    return createJsonRpcError(id, -32601, `Tool not found: ${name}`);
  }
  
  // Validate arguments
  const validation = tool.schema.safeParse(args);
  if (!validation.success) {
    return createJsonRpcError(id, -32602, 'Invalid parameters', {
      errors: validation.error.flatten(),
    });
  }
  
  // Create tool context
  const context = await createToolContext(request);
  
  // Check authentication if required
  if (tool.requiresAuth && !context.projectId) {
    return createJsonRpcError(id, -32603, 'Authentication required');
  }
  
  try {
    // Execute tool handler
    const result = await tool.handle(validation.data, context);
    return createJsonRpcSuccess(id, result);
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return createJsonRpcError(id, -32603, 
      error instanceof Error ? error.message : 'Internal error'
    );
  }
}

/**
 * Main MCP request handler
 */
export async function handleMcpRequest(request: NextRequest): Promise<NextResponse> {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Parse and validate request
    const body = await request.json();
    const validation = mcpRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        createJsonRpcError(
          body.id || null,
          -32700,
          'Parse error',
          validation.error.flatten()
        )
      );
    }
    
    const { id, method, params } = validation.data;
    
    // Route to appropriate handler
    let response;
    switch (method) {
      case 'initialize':
        response = await handleInitialize(id);
        break;
        
      case 'tools/list':
        response = await handleToolsList(id);
        break;
        
      case 'tools/call':
        response = await handleToolCall(id, params, request);
        break;
        
      case 'notifications/initialized':
        // Notification, no response needed
        return new NextResponse(null, { status: 204 });
        
      case 'shutdown':
        response = createJsonRpcSuccess(id, {});
        break;
        
      case 'exit':
        response = createJsonRpcSuccess(id, {});
        break;
        
      default:
        response = createJsonRpcError(id, -32601, `Method not found: ${method}`);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('MCP handler error:', error);
    return NextResponse.json(
      createJsonRpcError(
        null,
        -32603,
        'Internal error',
        error instanceof Error ? error.message : 'Unknown error'
      )
    );
  }
}