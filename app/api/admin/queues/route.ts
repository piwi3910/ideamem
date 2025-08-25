import { NextResponse } from 'next/server';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueues, QueueManager } from '@/lib/queue';

// Initialize Bull-Board once
let serverAdapter: ExpressAdapter | null = null;
let boardInitialized = false;

function initializeBullBoard() {
  if (boardInitialized) return serverAdapter;

  try {
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/api/admin/queues');

    const queues = getQueues();
    const queueAdapters = Object.values(queues).map(queue => new BullMQAdapter(queue));

    createBullBoard({
      queues: queueAdapters,
      serverAdapter,
    });

    boardInitialized = true;
    console.log('Bull-Board initialized successfully');
    return serverAdapter;
  } catch (error) {
    console.error('Failed to initialize Bull-Board:', error);
    return null;
  }
}

// GET /api/admin/queues - Get queue statistics
export async function GET() {
  try {
    // Initialize Bull-Board if not already done
    initializeBullBoard();

    // Get comprehensive queue statistics
    const stats = await QueueManager.getQueueStats();

    return NextResponse.json({
      success: true,
      queueStats: stats,
      dashboardUrl: '/api/admin/queues/ui',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST /api/admin/queues - Queue management operations
export async function POST(request: Request) {
  try {
    const { action, queueName, data } = await request.json();

    switch (action) {
      case 'pause':
        if (!queueName) {
          return NextResponse.json({ error: 'Queue name required' }, { status: 400 });
        }
        const pauseResult = await QueueManager.pauseQueue(queueName);
        return NextResponse.json({ success: pauseResult, action: 'pause', queueName });

      case 'resume':
        if (!queueName) {
          return NextResponse.json({ error: 'Queue name required' }, { status: 400 });
        }
        const resumeResult = await QueueManager.resumeQueue(queueName);
        return NextResponse.json({ success: resumeResult, action: 'resume', queueName });

      case 'clean':
        if (!queueName) {
          return NextResponse.json({ error: 'Queue name required' }, { status: 400 });
        }
        const grace = data?.grace || 24 * 60 * 60 * 1000; // 24 hours default
        const cleanResult = await QueueManager.cleanQueue(queueName, grace);
        return NextResponse.json({ success: cleanResult, action: 'clean', queueName, grace });

      case 'addJob':
        if (!data?.type || !data?.projectId) {
          return NextResponse.json({ error: 'Job type and projectId required' }, { status: 400 });
        }
        
        if (data.type === 'indexing') {
          const job = await QueueManager.addIndexingJob({
            projectId: data.projectId,
            jobId: data.jobId || `manual-${Date.now()}`,
            branch: data.branch || 'main',
            fullReindex: data.fullReindex || false,
            triggeredBy: 'MANUAL',
          });
          return NextResponse.json({ success: true, jobId: job.id, action: 'addJob' });
        }
        
        return NextResponse.json({ error: 'Unknown job type' }, { status: 400 });

      case 'cancelJob':
        if (!data?.jobId || !queueName) {
          return NextResponse.json({ error: 'Job ID and queue name required' }, { status: 400 });
        }
        const cancelResult = await QueueManager.cancelJob(data.jobId, queueName);
        return NextResponse.json({ success: cancelResult, action: 'cancel', jobId: data.jobId });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Queue management operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// DELETE /api/admin/queues - Emergency queue cleanup
export async function DELETE(request: Request) {
  try {
    const { queueName, confirm } = await request.json();

    if (confirm !== 'DELETE_ALL_JOBS') {
      return NextResponse.json({ 
        error: 'Must provide confirmation: "DELETE_ALL_JOBS"' 
      }, { status: 400 });
    }

    if (!queueName) {
      return NextResponse.json({ error: 'Queue name required' }, { status: 400 });
    }

    // Clean all jobs (immediate cleanup)
    const result = await QueueManager.cleanQueue(queueName, 0);

    return NextResponse.json({
      success: result,
      message: `All jobs cleaned from queue: ${queueName}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Emergency queue cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}