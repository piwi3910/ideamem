import { NextResponse } from 'next/server';
import { prisma, initializeDatabase } from '@/lib/database';

export async function GET() {
  try {
    await initializeDatabase();

    // Get all active (running) indexing jobs
    const activeJobs = await prisma.indexingJob.findMany({
      where: {
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    // Convert to the format expected by the frontend
    const runningJobs: Record<string, any> = {};
    for (const job of activeJobs) {
      runningJobs[job.projectId] = {
        projectId: job.projectId,
        status: job.status,
        progress: job.progress,
        currentFile: job.currentFile,
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles,
        vectorCount: job.vectorsAdded,
        startTime: job.startedAt?.toISOString(),
        endTime: job.completedAt?.toISOString(),
        error: job.errorMessage,
      };
    }

    return NextResponse.json({ jobs: runningJobs });
  } catch (error) {
    console.error('Error getting indexing status:', error);
    return NextResponse.json({ error: 'Failed to get indexing status' }, { status: 500 });
  }
}
