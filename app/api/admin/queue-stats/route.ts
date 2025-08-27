import { NextResponse, NextRequest } from 'next/server';
import { QueueManager } from '@/lib/queue';
import { getDocumentationSchedulerStatus } from '@/lib/documentation-scheduler';
import { MiddlewareStacks } from '@/lib/middleware/compose';

interface QueueStats {
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  error?: string | null;
}

export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
  // Get queue statistics
  const queueStats = await QueueManager.getQueueStats();
  
  // Get documentation scheduler status
  const docSchedulerStatus = await getDocumentationSchedulerStatus();
  
  // Calculate total jobs across all queues
  let totalJobs = 0;
  let totalActive = 0;
  let totalWaiting = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  
  Object.values(queueStats).forEach((stats: QueueStats) => {
    if (!stats.error) {
      totalJobs += (stats.waiting || 0) + (stats.active || 0) + (stats.completed || 0) + (stats.failed || 0);
      totalActive += stats.active || 0;
      totalWaiting += stats.waiting || 0;
      totalCompleted += stats.completed || 0;
      totalFailed += stats.failed || 0;
    }
  });
  
  return NextResponse.json({
    queueStats,
    documentationScheduler: docSchedulerStatus,
    summary: {
      totalJobs,
      totalActive,
      totalWaiting,
      totalCompleted,
      totalFailed,
    },
  });
});