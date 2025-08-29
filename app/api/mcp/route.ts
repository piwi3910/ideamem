import { NextRequest } from 'next/server';
import { MiddlewareStacks } from '@/lib/middleware/compose';
import { handleMcpRequest } from '@/lib/mcp/handler';

/**
 * MCP (Model Context Protocol) endpoint
 * 
 * This endpoint implements the MCP protocol for AI assistants to interact with the codebase.
 * All tool logic has been refactored into individual tool files in lib/mcp/tools/
 * 
 * @see lib/mcp/handler.ts for the main request handler
 * @see lib/mcp/tools/ for individual tool implementations
 */
export const POST = MiddlewareStacks.publicApi(
  async (request: NextRequest) => {
    return handleMcpRequest(request);
  }
);