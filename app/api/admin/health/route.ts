import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export async function POST(request: Request) {
  const { service } = await request.json();
  const config = await getConfig();

  if (!service) {
    return NextResponse.json({ status: 'error', message: 'Service not specified.' }, { status: 400 });
  }

  try {
    let url: string;
    if (service === 'qdrant') {
      url = config.qdrantUrl;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`Received status ${response.status}`);
      const data = await response.json();
      const version = data?.version || 'unknown';
      return NextResponse.json({ status: 'ok', message: `Successfully connected to Qdrant v${version}` });

    } else if (service === 'ollama') {
      url = config.ollamaUrl;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`Received status ${response.status}`);
      const text = await response.text();
      if (text.includes('Ollama is running')) {
        return NextResponse.json({ status: 'ok', message: 'Successfully connected to Ollama.' });
      } else {
        throw new Error('Unexpected response from Ollama.');
      }

    } else if (service === 'ollama-embedding') {
      url = `${config.ollamaUrl}/api/embeddings`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: 'test' }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        const errorMessage = errorBody.error || `Received status ${response.status}`;
        if (errorMessage.includes('not found')) {
          return NextResponse.json({ status: 'not_found', message: `Model 'nomic-embed-text' not found.` });
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.embedding && Array.isArray(data.embedding)) {
        return NextResponse.json({ status: 'ok', message: 'Successfully generated embedding with nomic-embed-text.' });
      } else {
        throw new Error('Invalid embedding response from Ollama.');
      }

    } else {
      return NextResponse.json({ status: 'error', message: 'Invalid service specified.' }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ status: 'error', message: `Connection failed: ${errorMessage}` });
  }
}
