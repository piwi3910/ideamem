import { NextResponse, NextRequest } from 'next/server';
import { getQdrantMetrics } from '@/lib/memory';
import { MiddlewareStacks } from '@/lib/middleware/compose';

export const GET = MiddlewareStacks.admin(async (request: NextRequest) => {
  const metrics = await getQdrantMetrics().catch((error) => {
    console.error('Error fetching Qdrant metrics:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch Qdrant performance metrics');
  });
  
  // Calculate some derived performance indicators
  const performanceIndicators = {
    indexing_efficiency: (metrics.collection.performance.indexed_vectors_count || 0) / Math.max(metrics.collection.points_count || 1, 1),
    indexing_progress: metrics.collection.performance.indexing_progress || 0,
    vectors_per_segment: metrics.collection.performance.vectors_per_segment || 0,
    collection_health: {
      status: metrics.collection.status,
      optimizer_status: metrics.collection.optimizer_status,
      total_vectors: metrics.collection.points_count || 0,
      total_segments: metrics.collection.segments_count || 0
    }
  };

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    metrics: {
      ...metrics,
      performance_indicators: performanceIndicators
    }
  });
});