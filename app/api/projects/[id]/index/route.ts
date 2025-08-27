import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getProject, startIndexingJob, cancelIndexingJob } from '@/lib/projects';
import { cancelIndexing } from '@/lib/indexing';
import { QueueManager, JOB_PRIORITIES } from '@/lib/queue';
import { composeMiddleware } from '@/lib/middleware/compose';
import { withValidation } from '@/lib/middleware/validation';

const paramsSchema = z.object({
  id: z.string(),
});

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: { requests: 5, window: '1 m' }, // Indexing is expensive
    security: { contentSecurityPolicy: false },
    compression: false,
    validation: { params: paramsSchema },
    errorHandling: { context: { resource: 'project-indexing' } },
  },
  async (request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.indexStatus === 'INDEXING') {
      return NextResponse.json({ error: 'Indexing already in progress' }, { status: 409 });
    }

    // Create indexing job in database
    const job = await startIndexingJob(id, {
      branch: 'main',
      fullReindex: true,
      triggeredBy: 'MANUAL',
    });

    // Add job to BullMQ queue instead of running directly
    console.log(`Attempting to add job to queue for project ${id} with job ID ${job.id}`);
    
    const queueResult = await QueueManager.addIndexingJob({
      projectId: id,
      jobId: job.id,
      branch: 'main',
      fullReindex: true,
      triggeredBy: 'MANUAL',
    }, JOB_PRIORITIES.HIGH); // Use HIGH priority for manual reindex
    
    console.log(`Queue job addition result:`, {
      bullmqJobId: queueResult?.id,
      bullmqJobName: queueResult?.name,
      bullmqJobData: queueResult?.data
    });
    
    console.log(`Added manual reindex job for project ${id} to queue`);
    
    // Verify the job was actually added
    const queueJob = await QueueManager.getActiveProjectJobs(id);
    console.log(`Queue job verification for ${id}:`, queueJob);
    
    // Also check queue stats after adding
    const queueStats = await QueueManager.getQueueStats();
    console.log(`Current queue stats after job addition:`, queueStats.indexing);

      return NextResponse.json({
        message: 'Indexing started',
        projectId: id,
      });
  }
);

export const DELETE = withValidation(
  { params: paramsSchema },
  async (_request: NextRequest, { params: { id } }: { params: z.infer<typeof paramsSchema> }) => {
    const success = cancelIndexing(id);

    if (success) {
      await cancelIndexingJob(id);
      return NextResponse.json({ message: 'Indexing cancelled' });
    } else {
      return NextResponse.json({ error: 'No active indexing job found' }, { status: 404 });
    }
  }
);
