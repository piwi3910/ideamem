import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, configureScheduledIndexing } from '@/lib/projects';
import { composeMiddleware } from '@/lib/middleware/compose';

const paramsSchema = z.object({
  id: z.string(),
});

const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number()
    .min(5, 'Interval must be at least 5 minutes')
    .max(10080, 'Interval cannot exceed 7 days (10080 minutes)')
    .optional(),
  branch: z.string().optional(),
});

export const GET = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 60, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema },
    errorHandling: { context: { resource: 'project-schedule' } },
  },
  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      scheduledIndexingEnabled: project.scheduledIndexingEnabled || false,
      scheduledIndexingInterval: project.scheduledIndexingInterval || 60,
      scheduledIndexingBranch: project.scheduledIndexingBranch || 'main',
      lastScheduledIndexingAt: project.scheduledIndexingLastRun,
      scheduledIndexingNextRun: project.scheduledIndexingNextRun,
    });
  }
);

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 10, window: '1 m' },
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema, body: scheduleConfigSchema },
    errorHandling: { context: { resource: 'project-schedule' } },
  },
  async (request: NextRequest, { params: { id }, body: { enabled, intervalMinutes, branch } }: { 
    params: z.infer<typeof paramsSchema>,
    body: z.infer<typeof scheduleConfigSchema>
  }) => {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updatedProject = await configureScheduledIndexing(id, {
      enabled,
      interval: intervalMinutes,
      branch,
    });

    if (!updatedProject) {
      return NextResponse.json(
        { error: 'Failed to update scheduled indexing configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduledIndexingEnabled: updatedProject.scheduledIndexingEnabled,
        scheduledIndexingInterval: updatedProject.scheduledIndexingInterval,
        scheduledIndexingBranch: updatedProject.scheduledIndexingBranch,
        scheduledIndexingNextRun: updatedProject.scheduledIndexingNextRun,
        message: enabled
          ? `Scheduled indexing enabled. Next run: ${updatedProject.scheduledIndexingNextRun}`
          : 'Scheduled indexing disabled',
      });
  }
);
