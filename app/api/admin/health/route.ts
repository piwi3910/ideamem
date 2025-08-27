import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { composeMiddleware } from '@/lib/middleware/compose';

const healthCheckSchema = z.object({
  service: z.enum(['qdrant', 'ollama', 'ollama-embedding']).optional(),
});

export const POST = composeMiddleware(
  {
    cors: { origin: '*', credentials: true },
    rateLimit: false, // No rate limiting for health checks
    security: { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } },
    compression: false, // Health checks should be fast
    validation: { body: healthCheckSchema.optional() },
    errorHandling: { context: { type: 'health' } },
  },
  async (request: NextRequest, { body }: { body?: z.infer<typeof healthCheckSchema> }) => {
    const service = body?.service || null;
  
  const config = await getConfig();

  // If no service specified, check all services
  if (!service) {
    const results = {
      qdrant: { status: 'unknown', url: config.qdrantUrl, error: null as string | null, collections: [] },
      ollama: { status: 'unknown', url: config.ollamaUrl, error: null as string | null, models: [] }
    };

    // Test Qdrant
    const qdrantResponse = await fetch(config.qdrantUrl, { method: 'GET' }).catch((error) => {
      results.qdrant.status = 'unhealthy';
      results.qdrant.error = error instanceof Error ? error.message : 'Connection failed';
      return null;
    });
    
    if (qdrantResponse && qdrantResponse.ok) {
      results.qdrant.status = 'healthy';
      
      // Try to get collections
      const collectionsResponse = await fetch(`${config.qdrantUrl}/collections`).catch(() => null);
      if (collectionsResponse && collectionsResponse.ok) {
        const collectionsData = await collectionsResponse.json();
        results.qdrant.collections = collectionsData.result?.collections || [];
      }
    } else if (qdrantResponse) {
      results.qdrant.status = 'unhealthy';
      results.qdrant.error = `HTTP ${qdrantResponse.status}`;
    }

    // Test Ollama
    const ollamaResponse = await fetch(config.ollamaUrl, { method: 'GET' }).catch((error) => {
      results.ollama.status = 'unhealthy';
      results.ollama.error = error instanceof Error ? error.message : 'Connection failed';
      return null;
    });
    
    if (ollamaResponse && ollamaResponse.ok) {
      results.ollama.status = 'healthy';
      
      // Try to get models
      const modelsResponse = await fetch(`${config.ollamaUrl}/api/tags`).catch(() => null);
      if (modelsResponse && modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        results.ollama.models = modelsData.models?.map((m: { name: string }) => m.name) || [];
      }
    } else if (ollamaResponse) {
      results.ollama.status = 'unhealthy';
      results.ollama.error = `HTTP ${ollamaResponse.status}`;
    }

    return NextResponse.json(results);
  }

  let url: string;
  if (service === 'qdrant') {
    url = config.qdrantUrl;
    const response = await fetch(url, { method: 'GET' }).catch(() => null);
    if (!response || !response.ok) {
      return NextResponse.json({
        status: 'error',
        message: `Connection failed: ${response ? `Received status ${response.status}` : 'Network error'}`
      });
    }
    const data = await response.json();
    const version = data?.version || 'unknown';
    return NextResponse.json({
      status: 'ok',
      message: `Successfully connected to Qdrant v${version}`,
    });
  } else if (service === 'ollama') {
    url = config.ollamaUrl;
    const response = await fetch(url, { method: 'GET' }).catch(() => null);
    if (!response || !response.ok) {
      return NextResponse.json({
        status: 'error',
        message: `Connection failed: ${response ? `Received status ${response.status}` : 'Network error'}`
      });
    }
    const text = await response.text();
    if (text.includes('Ollama is running')) {
      return NextResponse.json({ status: 'ok', message: 'Successfully connected to Ollama.' });
    } else {
      return NextResponse.json({ status: 'error', message: 'Unexpected response from Ollama.' });
    }
  } else if (service === 'ollama-embedding') {
    url = `${config.ollamaUrl}/api/embeddings`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: 'test' }),
    }).catch(() => null);

    if (!response || !response.ok) {
      if (response) {
        const errorBody = await response.json();
        const errorMessage = errorBody.error || `Received status ${response.status}`;
        if (errorMessage.includes('not found')) {
          return NextResponse.json({
            status: 'not_found',
            message: `Model 'nomic-embed-text' not found.`,
          });
        }
        return NextResponse.json({ status: 'error', message: `Connection failed: ${errorMessage}` });
      }
      return NextResponse.json({ status: 'error', message: 'Connection failed: Network error' });
    }

    const data = await response.json();
    if (data.embedding && Array.isArray(data.embedding)) {
      return NextResponse.json({
        status: 'ok',
        message: 'Successfully generated embedding with nomic-embed-text.',
      });
    } else {
      return NextResponse.json({ status: 'error', message: 'Invalid embedding response from Ollama.' });
    }
  } else {
    return NextResponse.json(
      { status: 'error', message: 'Invalid service specified.' },
      { status: 400 }
    );
  }
  }
);
