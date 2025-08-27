import { NextResponse, NextRequest } from 'next/server';
import { QueueManager } from '@/lib/queue';
import { startWorkers } from '@/lib/workers';
import { MiddlewareStacks } from '@/lib/middleware/compose';

export const POST = MiddlewareStacks.admin(async (request: NextRequest) => {
  console.log('Queue management request at:', new Date().toISOString());

  // Get queue statistics (workers should already be started by startup.ts)
  const stats = await QueueManager.getQueueStats();

  return NextResponse.json({
    success: true,
    message: 'BullMQ workers running and processing jobs',
    queueStats: stats,
    timestamp: new Date().toISOString(),
  });
});

export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
  // Get queue statistics for monitoring
  const stats = await QueueManager.getQueueStats();

  return NextResponse.json({
    success: true,
    queueStats: stats,
    timestamp: new Date().toISOString(),
  });
});
