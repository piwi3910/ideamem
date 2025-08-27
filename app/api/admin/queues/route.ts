import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueues, QueueManager } from '@/lib/queue';
import { MiddlewareStacks } from '@/lib/middleware/compose';
import { withValidation } from '@/lib/middleware/validation';

// Define schemas for queue operations
const queueActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pause'),
    queueName: z.string().min(1, 'Queue name required'),
  }),
  z.object({
    action: z.literal('resume'),
    queueName: z.string().min(1, 'Queue name required'),
  }),
  z.object({
    action: z.literal('clean'),
    queueName: z.string().min(1, 'Queue name required'),
    data: z.object({
      grace: z.number().optional(),
    }).optional(),
  }),
  z.object({
    action: z.literal('addJob'),
    data: z.object({
      type: z.literal('indexing'),
      projectId: z.string().min(1, 'Project ID required'),
      jobId: z.string().optional(),
      branch: z.string().optional(),
      fullReindex: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal('cancelJob'),
    queueName: z.string().min(1, 'Queue name required'),
    data: z.object({
      jobId: z.string().min(1, 'Job ID required'),
    }),
  }),
]);

const deleteQueueSchema = z.object({
  queueName: z.string().min(1, 'Queue name required'),
  confirm: z.literal('DELETE_ALL_JOBS'),
});

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
export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
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
});

// POST /api/admin/queues - Queue management operations
export const POST = withValidation(
  { body: queueActionSchema },
  async (_request: NextRequest, { body }: { body: z.infer<typeof queueActionSchema> }) => {
      switch (body.action) {
        case 'pause': {
          const pauseResult = await QueueManager.pauseQueue(body.queueName);
          return NextResponse.json({ success: pauseResult, action: 'pause', queueName: body.queueName });
        }

        case 'resume': {
          const resumeResult = await QueueManager.resumeQueue(body.queueName);
          return NextResponse.json({ success: resumeResult, action: 'resume', queueName: body.queueName });
        }

        case 'clean': {
          const grace = body.data?.grace || 24 * 60 * 60 * 1000; // 24 hours default
          const cleanResult = await QueueManager.cleanQueue(body.queueName, grace);
          return NextResponse.json({ success: cleanResult, action: 'clean', queueName: body.queueName, grace });
        }

        case 'addJob': {
          const job = await QueueManager.addIndexingJob({
            projectId: body.data.projectId,
            jobId: body.data.jobId || `manual-${Date.now()}`,
            branch: body.data.branch || 'main',
            fullReindex: body.data.fullReindex || false,
            triggeredBy: 'MANUAL',
          });
          return NextResponse.json({ success: true, jobId: job.id, action: 'addJob' });
        }

        case 'cancelJob': {
          const cancelResult = await QueueManager.cancelJob(body.data.jobId, body.queueName);
          return NextResponse.json({ success: cancelResult, action: 'cancel', jobId: body.data.jobId });
        }

        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      }
  }
);

// DELETE /api/admin/queues - Emergency queue cleanup
export const DELETE = withValidation(
  { body: deleteQueueSchema },
  async (_request: NextRequest, { body: { queueName } }: { body: z.infer<typeof deleteQueueSchema> }) => {
      // Clean all jobs (immediate cleanup)
      const result = await QueueManager.cleanQueue(queueName, 0);

      return NextResponse.json({
        success: result,
        message: `All jobs cleaned from queue: ${queueName}`,
        timestamp: new Date().toISOString(),
      });
  }
);