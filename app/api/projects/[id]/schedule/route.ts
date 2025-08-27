import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, configureScheduledIndexing } from '@/lib/projects';
import { withValidation } from '@/lib/middleware/validation';

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

export const GET = withValidation(
  { params: paramsSchema },
  async (_request: NextRequest, { params: { id } }) => {
    try {
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
    } catch (error) {
      console.error('Error getting scheduled indexing config:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const POST = withValidation(
  { params: paramsSchema, body: scheduleConfigSchema },
  async (_request: NextRequest, { params: { id }, body: { enabled, intervalMinutes, branch } }) => {
    try {
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
    } catch (error) {
      console.error('Error configuring scheduled indexing:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
