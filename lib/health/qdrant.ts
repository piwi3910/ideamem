import { getConfig } from '@/lib/config';

export async function checkQdrantHealth(): Promise<{ status: 'healthy' | 'unhealthy'; url: string; error: string | null; collections: any[] }> {
  const config = await getConfig();
  const result = { status: 'unknown', url: config.qdrantUrl, error: null, collections: [] };

  try {
    const qdrantResponse = await fetch(config.qdrantUrl, { method: 'GET' });
    if (qdrantResponse.ok) {
      result.status = 'healthy';
      
      try {
        const collectionsResponse = await fetch(`${config.qdrantUrl}/collections`);
        if (collectionsResponse.ok) {
          const collectionsData = await collectionsResponse.json();
          result.collections = collectionsData.result?.collections || [];
        }
      } catch (collectionsError) {
        // Collections fetch failed, but service is still healthy
      }
    } else {
      result.status = 'unhealthy';
      result.error = `HTTP ${qdrantResponse.status}`;
    }
  } catch (error) {
    result.status = 'unhealthy';
    result.error = error instanceof Error ? error.message : 'Connection failed';
  }

  return result as any;
}
