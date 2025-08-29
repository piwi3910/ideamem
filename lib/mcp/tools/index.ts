/**
 * Central export for all MCP tools
 * Add new tools here as they are created
 */

export { codebaseStoreTool } from './codebase-store';
export { codebaseSearchTool } from './codebase-search';
export { codebaseCheckConstraintsTool } from './codebase-check-constraints';
export { codebaseForgetTool } from './codebase-forget';

// Import all tools for registration
import { codebaseStoreTool } from './codebase-store';
import { codebaseSearchTool } from './codebase-search';
import { codebaseCheckConstraintsTool } from './codebase-check-constraints';
import { codebaseForgetTool } from './codebase-forget';

// Export array of all tools for easy registration
export const allTools = [
  codebaseStoreTool,
  codebaseSearchTool,
  codebaseCheckConstraintsTool,
  codebaseForgetTool,
];