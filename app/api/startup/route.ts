import { NextResponse } from 'next/server';
import { initializeApp } from '@/lib/startup';

export async function POST() {
  try {
    await initializeApp();
    
    return NextResponse.json({
      success: true,
      message: 'Application initialized successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Application initialization failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Startup API available',
    endpoint: 'POST to initialize workers',
    timestamp: new Date().toISOString(),
  });
}