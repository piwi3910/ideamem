import { z } from 'zod';
import { Tool, ToolContext, requireProjectAuth } from '../tool';
import { ingest } from '@/lib/memory';

const schema = z.object({
  content: z.string().describe('The raw text or code content to be ingested'),
  source: z.string().describe('Unique identifier for the content origin'),
  type: z.enum(['code', 'documentation', 'conversation']).describe('Content category'),
  language: z.string().describe('Programming or markup language'),
});

export const codebaseStoreTool: Tool<typeof schema> = {
  name: 'codebase.store',
  description: '🤖 AI ASSISTANT: Store code/docs for future semantic search. WHEN TO USE: After reading important files, discovering key implementations, or learning new patterns.',
  schema,
  requiresAuth: true,
  
  async handle(args, context: ToolContext) {
    const { projectId } = requireProjectAuth(context);
    
    const result = await ingest({
      content: args.content,
      source: args.source,
      type: args.type as 'code' | 'documentation' | 'conversation',
      language: args.language,
      project_id: projectId,
      scope: 'project',
    });
    
    return {
      success: result.success,
      vectors_added: result.vectors_added,
      message: `Successfully stored ${result.vectors_added} vectors for ${args.source}`,
    };
  },
};