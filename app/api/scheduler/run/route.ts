import { NextResponse } from 'next/server';
import { QueueManager } from '@/lib/queue';
import { startWorkers } from '@/lib/workers';

export async function POST(_request: Request) {
  try {
    console.log('Queue management request at:', new Date().toISOString());

    // Start workers if not already running
    startWorkers();

    // Get queue statistics
    const stats = await QueueManager.getQueueStats();

    return NextResponse.json({
      success: true,
      message: 'BullMQ workers running and processing jobs',
      queueStats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue management failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get queue statistics for monitoring
    const stats = await QueueManager.getQueueStats();

    return NextResponse.json({
      success: true,
      queueStats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
