import { z } from 'zod';
import { Tool, ToolContext, requireProjectAuth } from '../tool';
import { deleteSource } from '@/lib/memory';

const schema = z.object({
  source: z.string().describe('Exact source identifier to delete'),
});

export const codebaseForgetTool: Tool<typeof schema> = {
  name: 'codebase.forget',
  description: '🗑️ AI ASSISTANT: Remove outdated/deleted code from search index.',
  schema,
  requiresAuth: true,
  
  async handle(args, context: ToolContext) {
    const { projectId } = requireProjectAuth(context);
    
    const result = await deleteSource(args.source, projectId);
    
    return {
      success: result.success,
      deleted_count: result.deleted_count,
      message: result.deleted_count > 0 
        ? `Successfully deleted ${result.deleted_count} vectors for source: ${args.source}`
        : `No vectors found for source: ${args.source}`,
    };
  },
};