import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { startWorkers, stopWorkers } from '@/lib/workers';
import { MiddlewareStacks } from '@/lib/middleware/compose';
import { withValidation } from '@/lib/middleware/validation';

const workerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'restart']),
});

// GET /api/admin/workers - Check worker status
export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
  // This is a simple status check
  // In a production environment, you might want to track worker health
  return NextResponse.json({
    success: true,
    message: 'Worker management API available',
    timestamp: new Date().toISOString(),
  });
});

// POST /api/admin/workers - Start or restart workers
export const POST = withValidation(
  { body: workerActionSchema },
  async (_request: NextRequest, { body: { action } }: { body: z.infer<typeof workerActionSchema> }) => {
    switch (action) {
      case 'start': {
        const workers = startWorkers();
        return NextResponse.json({
          success: true,
          message: 'Workers started successfully',
          workerCount: Object.keys(workers).length,
          workers: Object.keys(workers),
          timestamp: new Date().toISOString(),
        });
      }

      case 'stop': {
        await stopWorkers();
        return NextResponse.json({
          success: true,
          message: 'Workers stopped successfully',
          timestamp: new Date().toISOString(),
        });
      }

      case 'restart': {
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
      }
    }
  }
);

// DELETE /api/admin/workers - Emergency worker shutdown
export const DELETE = MiddlewareStacks.admin(async (request: NextRequest) => {
  await stopWorkers();
  
  return NextResponse.json({
    success: true,
    message: 'All workers shut down',
    timestamp: new Date().toISOString(),
  });
});