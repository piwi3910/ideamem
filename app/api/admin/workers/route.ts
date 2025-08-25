import { NextResponse } from 'next/server';
import { startWorkers, stopWorkers } from '@/lib/workers';

// GET /api/admin/workers - Check worker status
export async function GET() {
  try {
    // This is a simple status check
    // In a production environment, you might want to track worker health
    return NextResponse.json({
      success: true,
      message: 'Worker management API available',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking worker status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST /api/admin/workers - Start or restart workers
export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'start':
        const workers = startWorkers();
        return NextResponse.json({
          success: true,
          message: 'Workers started successfully',
          workerCount: Object.keys(workers).length,
          workers: Object.keys(workers),
          timestamp: new Date().toISOString(),
        });

      case 'stop':
        await stopWorkers();
        return NextResponse.json({
          success: true,
          message: 'Workers stopped successfully',
          timestamp: new Date().toISOString(),
        });

      case 'restart':
        await stopWorkers();
        // Give workers time to shut down gracefully
        await new Promise(resolve => setTimeout(resolve, 1000));
        const restartedWorkers = startWorkers();
        return NextResponse.json({
          success: true,
          message: 'Workers restarted successfully',
          workerCount: Object.keys(restartedWorkers).length,
          workers: Object.keys(restartedWorkers),
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "start", "stop", or "restart"' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Worker management failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// DELETE /api/admin/workers - Emergency worker shutdown
export async function DELETE() {
  try {
    await stopWorkers();
    
    return NextResponse.json({
      success: true,
      message: 'All workers shut down',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Emergency worker shutdown failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}