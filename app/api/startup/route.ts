import { NextResponse, NextRequest } from 'next/server';
import { initializeApp } from '@/lib/startup';
import { MiddlewareStacks } from '@/lib/middleware/compose';

export const POST = MiddlewareStacks.admin(async (request: NextRequest) => {
  await initializeApp();
  
  return NextResponse.json({
    success: true,
    message: 'Application initialized successfully',
    timestamp: new Date().toISOString(),
  });
});

export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
  return NextResponse.json({
    message: 'Startup API available',
    endpoint: 'POST to initialize workers',
    timestamp: new Date().toISOString(),
  });
});