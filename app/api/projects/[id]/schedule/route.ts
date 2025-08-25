import { NextResponse } from 'next/server';
import { getProject, configureScheduledIndexing } from '@/lib/projects';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { enabled, intervalMinutes, branch } = body;

    // Validate interval
    if (enabled && intervalMinutes && (intervalMinutes < 5 || intervalMinutes > 10080)) {
      return NextResponse.json(
        { error: 'Interval must be between 5 minutes and 7 days (10080 minutes)' },
        { status: 400 }
      );
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
