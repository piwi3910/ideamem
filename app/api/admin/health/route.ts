import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getConfig } from '@/lib/config';
import { withValidation } from '@/lib/middleware/validation';

const healthCheckSchema = z.object({
  service: z.enum(['qdrant', 'ollama', 'ollama-embedding']).optional(),
});

export const POST = withValidation(
  { body: healthCheckSchema.optional() },
  async (_request: NextRequest, { body }) => {
    const service = body?.service || null;
  
  const config = await getConfig();

  // If no service specified, check all services
  if (!service) {
    const results = {
      qdrant: { status: 'unknown', url: config.qdrantUrl, error: null as string | null, collections: [] },
      ollama: { status: 'unknown', url: config.ollamaUrl, error: null as string | null, models: [] }
    };

    // Test Qdrant
    try {
      const qdrantResponse = await fetch(config.qdrantUrl, { method: 'GET' });
      if (qdrantResponse.ok) {
        results.qdrant.status = 'healthy';
        
        // Try to get collections
        try {
          const collectionsResponse = await fetch(`${config.qdrantUrl}/collections`);
          if (collectionsResponse.ok) {
            const collectionsData = await collectionsResponse.json();
            results.qdrant.collections = collectionsData.result?.collections || [];
          }
        } catch (collectionsError) {
          // Collections fetch failed, but service is still healthy
        }
      } else {
        results.qdrant.status = 'unhealthy';
        results.qdrant.error = `HTTP ${qdrantResponse.status}`;
      }
    } catch (error) {
      results.qdrant.status = 'unhealthy';
      results.qdrant.error = error instanceof Error ? error.message : 'Connection failed';
    }

    // Test Ollama
    try {
      const ollamaResponse = await fetch(config.ollamaUrl, { method: 'GET' });
      if (ollamaResponse.ok) {
        results.ollama.status = 'healthy';
        
        // Try to get models
        try {
          const modelsResponse = await fetch(`${config.ollamaUrl}/api/tags`);
          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            results.ollama.models = modelsData.models?.map((m: any) => m.name) || [];
          }
        } catch (modelsError) {
          // Models fetch failed, but service is still healthy
        }
      } else {
        results.ollama.status = 'unhealthy';
        results.ollama.error = `HTTP ${ollamaResponse.status}`;
      }
    } catch (error) {
      results.ollama.status = 'unhealthy';
      results.ollama.error = error instanceof Error ? error.message : 'Connection failed';
    }

    return NextResponse.json(results);
  }

  try {
    let url: string;
    if (service === 'qdrant') {
      url = config.qdrantUrl;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) throw new Error(`Received status ${response.status}`);
      const data = await response.json();
      const version = data?.version || 'unknown';
      return NextResponse.json({
        status: 'ok',
        message: `Successfully connected to Qdrant v${version}`,
      });
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
          return NextResponse.json({
            status: 'not_found',
            message: `Model 'nomic-embed-text' not found.`,
          });
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.embedding && Array.isArray(data.embedding)) {
        return NextResponse.json({
          status: 'ok',
          message: 'Successfully generated embedding with nomic-embed-text.',
        });
      } else {
        throw new Error('Invalid embedding response from Ollama.');
      }
    } else {
      return NextResponse.json(
        { status: 'error', message: 'Invalid service specified.' },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ status: 'error', message: `Connection failed: ${errorMessage}` });
  }
  }
);
