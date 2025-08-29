import { z } from 'zod';

/**
 * Base interface for MCP tools
 */
export interface Tool<T extends z.ZodSchema = z.ZodSchema> {
  /**
   * The name of the tool as it appears in the MCP protocol
   */
  name: string;
  
  /**
   * A description of what the tool does
   */
  description: string;
  
  /**
   * The Zod schema for validating the tool's arguments
   */
  schema: T;
  
  /**
   * Whether this tool requires project authentication
   */
  requiresAuth?: boolean;
  
  /**
   * The handler function that executes the tool's logic
   */
  handle(args: z.infer<T>, context: ToolContext): Promise<any>;
}

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  /**
   * The project ID if the request is authenticated
   */
  projectId?: string;
  
  /**
   * The bearer token if provided
   */
  token?: string;
  
  /**
   * The original request object
   */
  request: Request;
}

/**
 * Type guard to check if a tool requires authentication
 */
export function requiresAuth(tool: Tool): boolean {
  return tool.requiresAuth === true;
}

/**
 * Helper to ensure a tool has authentication context
 */
export function requireProjectAuth(context: ToolContext): { projectId: string } {
  if (!context.projectId) {
    throw new Error('This tool requires project authentication');
  }
  return { projectId: context.projectId };
}