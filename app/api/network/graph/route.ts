import { NextRequest, NextResponse } from 'next/server';
import { RelationshipAnalyzer } from '../../../../lib/relationship-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, includeWeakRelationships = false, minStrength = 0.3, maxNodes = 200 } = body;

    console.log('Building documentation graph with options:', {
      projectId,
      includeWeakRelationships,
      minStrength,
      maxNodes,
    });

    const graph = await RelationshipAnalyzer.buildDocumentationGraph(projectId, {
      includeWeakRelationships,
      minStrength,
      maxNodes,
    });

    console.log('Graph built successfully:', {
      nodes: graph.nodes.length,
      relationships: graph.relationships.length,
      clusters: graph.clusters.length,
    });

    return NextResponse.json(graph);
  } catch (error) {
    console.error('Error building documentation graph:', error);
    return NextResponse.json(
      {
        error: 'Failed to build documentation graph',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to build documentation graph with options',
  });
}
