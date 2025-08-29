import { z } from 'zod';
import { Tool, ToolContext, requireProjectAuth } from '../tool';
import { retrieve } from '@/lib/memory';

const schema = z.object({
  query: z.string().describe('Natural language query describing what you\'re looking for'),
  filters: z.object({
    type: z.enum(['code', 'documentation', 'conversation']).optional(),
    language: z.string().optional(),
    source: z.string().optional(),
  }).optional().describe('Optional filters to narrow search scope'),
});

export const codebaseSearchTool: Tool<typeof schema> = {
  name: 'codebase.search',
  description: '🔍 AI ASSISTANT: SEARCH FIRST before Read/Grep! Finds code by meaning, not just keywords.',
  schema,
  requiresAuth: true,
  
  async handle(args, context: ToolContext) {
    const { projectId } = requireProjectAuth(context);
    
    const results = await retrieve({
      query: args.query,
      project_id: projectId,
      filters: args.filters,
      limit: 10,
    });
    
    return {
      success: true,
      results: results.map(r => ({
        content: r.payload?.content || r.content || '',
        source: r.payload?.source || 'unknown',
        type: r.payload?.type || 'unknown',
        language: r.payload?.language || 'unknown',
        similarity: r.score,
      })),
      count: results.length,
    };
  },
};