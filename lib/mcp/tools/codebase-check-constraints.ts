import { z } from 'zod';
import { Tool, ToolContext, requireProjectAuth } from '../tool';
import { prisma } from '@/lib/database';

const schema = z.object({
  coding_task: z.string().optional().describe('Brief description of what you\'re about to code'),
});

export const codebaseCheckConstraintsTool: Tool<typeof schema> = {
  name: 'codebase.check_constraints',
  description: '🚨 AI ASSISTANT: MANDATORY FIRST STEP before coding! Retrieves coding rules and preferences from database that must be followed.',
  schema,
  requiresAuth: false, // Can work without auth for global preferences
  
  async handle(args, context: ToolContext) {
    // Get global preferences (available to all)
    const globalPreferences = await prisma.globalPreference.findMany({
      where: {
        category: { in: ['rule', 'tooling', 'workflow', 'formatting'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return {
      success: true,
      constraints: globalPreferences.map(pref => ({
        source: pref.source,
        category: pref.category,
        content: pref.content,
        scope: 'global',
      })),
      task_context: args.coding_task,
      message: `Found ${globalPreferences.length} global constraints`,
    };
  },
};