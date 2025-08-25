import { NextResponse } from 'next/server';
import { getQdrantMetrics } from '@/lib/memory';

export async function GET() {
  try {
    const metrics = await getQdrantMetrics();
    
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

  } catch (error: any) {
    console.error('Error fetching Qdrant metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch Qdrant performance metrics'
      },
      { status: 500 }
    );
  }
}