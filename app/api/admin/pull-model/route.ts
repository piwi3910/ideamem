import { NextResponse, NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { MiddlewareStacks } from '@/lib/middleware/compose';

export const POST = MiddlewareStacks.admin(async (request: NextRequest) => {
  console.log("Attempting to pull 'nomic-embed-text' model from Ollama...");

  const ollamaPull = spawn('ollama', ['pull', 'nomic-embed-text']);

  ollamaPull.stdout.on('data', (data) => {
    console.log(`Ollama Pull (stdout): ${data}`);
  });

  ollamaPull.stderr.on('data', (data) => {
    console.error(`Ollama Pull (stderr): ${data}`);
  });

  ollamaPull.on('close', (code) => {
    if (code === 0) {
      console.log('Ollama pull command completed successfully.');
    } else {
      console.error(`Ollama pull command exited with code ${code}`);
    }
  });

  ollamaPull.on('error', (error) => {
    console.error('Failed to spawn Ollama process:', error);
  });

  return NextResponse.json({
    status: 'pulling_started',
    message:
      "Started pulling 'nomic-embed-text' model. See server logs for progress. This may take several minutes.",
  });
});
