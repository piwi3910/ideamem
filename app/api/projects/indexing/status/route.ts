import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { prisma, initializeDatabase } from '@/lib/database';
import { MiddlewareStacks } from '@/lib/middleware/compose';
import { JobStatus } from '@prisma/client';

interface IndexingJobStatus {
  projectId: string;
  status: string;
  progress: number | null;
  currentFile: string | null;
  totalFiles: number | null;
  processedFiles: number | null;
  vectorCount: number;
  startTime: string | undefined;
  endTime: string | undefined;
  error: string | null;
}

export const GET = MiddlewareStacks.api(
  async (request: NextRequest) => {
    await initializeDatabase();
    
    // Get projectId from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Build query based on whether projectId is provided
    const where = projectId 
      ? { projectId, status: { in: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as JobStatus[] } }
      : { status: { in: ['PENDING', 'RUNNING'] as JobStatus[] } };

    // Get indexing jobs
    const jobs = await prisma.indexingJob.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: projectId ? 10 : undefined, // Limit per-project results
    });

    // Convert to the format expected by the frontend
    const formattedJobs = jobs.map(job => ({
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress || 0,
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      filesProcessed: job.processedFiles,
      vectorsAdded: job.vectorsAdded,
      lastError: job.errorMessage,
    }));

    return NextResponse.json({ jobs: formattedJobs });
  }
);
