import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
  try {
    console.log("Attempting to pull 'starcoder' model from Ollama...");

    const ollamaPull = spawn('ollama', ['pull', 'nomic-embed-text']);

    ollamaPull.stdout.on('data', (data) => {
      console.log(`Ollama Pull (stdout): ${data}`);
    });

    ollamaPull.stderr.on('data', (data) => {
      console.error(`Ollama Pull (stderr): ${data}`);
    });

    ollamaPull.on('close', (code) => {
      if (code === 0) {
        console.log("Ollama pull command completed successfully.");
      } else {
        console.error(`Ollama pull command exited with code ${code}`);
      }
    });

    return NextResponse.json({
      status: 'pulling_started',
      message: "Started pulling 'starcoder' model. See server logs for progress. This may take several minutes.",
    });

  } catch (error) {
    console.error('Failed to start Ollama pull command:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ status: 'error', message: `Failed to start pull command: ${errorMessage}` }, { status: 500 });
  }
}
