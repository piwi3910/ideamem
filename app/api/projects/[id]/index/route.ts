import { NextResponse } from 'next/server';
import { getProject, startIndexingJob, cancelIndexingJob } from '@/lib/projects';
import { cancelIndexing } from '@/lib/indexing';
import { QueueManager, JOB_PRIORITIES } from '@/lib/queue';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    try {
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
      
    } catch (queueError) {
      const errorDetails = queueError instanceof Error ? {
        message: queueError.message,
        stack: queueError.stack,
        name: queueError.name
      } : { message: String(queueError) };
      
      console.error('Failed to add reindex job to queue:', queueError);
      console.error('Queue error details:', errorDetails);
      // Cancel the database job if queue fails
      await cancelIndexingJob(id);
      throw queueError;
    }

    return NextResponse.json({
      message: 'Indexing started',
      projectId: id,
    });
  } catch (error) {
    console.error('Error starting indexing:', error);
    return NextResponse.json({ error: 'Failed to start indexing' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = cancelIndexing(id);

    if (success) {
      await cancelIndexingJob(id);
      return NextResponse.json({ message: 'Indexing cancelled' });
    } else {
      return NextResponse.json({ error: 'No active indexing job found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error cancelling indexing:', error);
    return NextResponse.json({ error: 'Failed to cancel indexing' }, { status: 500 });
  }
}
