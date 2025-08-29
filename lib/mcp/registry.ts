import { Tool } from './tool';

/**
 * Registry for all MCP tools
 */
class ToolRegistry {
  private tools: Map<string, Tool<any>> = new Map();
  
  /**
   * Register a tool in the registry
   */
  register(tool: Tool<any>): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }
  
  /**
   * Register multiple tools at once
   */
  registerAll(tools: Tool<any>[]): void {
    tools.forEach(tool => this.register(tool));
  }
  
  /**
   * Get a tool by name
   */
  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Get all registered tools
   */
  getAll(): Tool<any>[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }
  
  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
  
  /**
   * Get tools list for MCP protocol
   */
  getToolsList(): Array<{ name: string; description: string; inputSchema: any }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: tool.schema._def.shape || {},
        required: Object.keys(tool.schema._def.shape || {}).filter(key => 
          !tool.schema._def.shape[key].isOptional()
        ),
      },
    }));
  }
}

// Create a singleton instance
export const toolRegistry = new ToolRegistry();

// Export convenience functions
export const registerTool = (tool: Tool<any>) => toolRegistry.register(tool);
export const registerTools = (tools: Tool<any>[]) => toolRegistry.registerAll(tools);
export const getTool = (name: string) => toolRegistry.get(name);
export const hasTool = (name: string) => toolRegistry.has(name);
export const getAllTools = () => toolRegistry.getAll();
export const getToolNames = () => toolRegistry.getNames();
export const getToolsList = () => toolRegistry.getToolsList();