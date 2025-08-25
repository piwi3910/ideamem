import { NextRequest, NextResponse } from 'next/server';
import {
  SearchVisualizationEngine,
} from '../../../../lib/search-visualization';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { results, query, searchType = 'hybrid', settings } = body;

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Results array is required' }, { status: 400 });
    }

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    console.log('Generating search result visualizations for', results.length, 'results');

    // Generate comprehensive visualizations
    const visualizedResults = await SearchVisualizationEngine.generateSearchVisualization(
      results,
      query,
      searchType,
      settings
    );

    // Generate summary analytics
    const summary = SearchVisualizationEngine.generateVisualizationSummary(visualizedResults);

    console.log('Generated visualizations:', {
      resultsCount: visualizedResults.length,
      averageScore: summary?.averageScore,
      searchQuality: summary?.searchQuality,
    });

    return NextResponse.json({
      query,
      searchType,
      visualizedResults,
      summary,
      metadata: {
        totalResults: visualizedResults.length,
        generatedAt: new Date().toISOString(),
        processingTime: Date.now(),
      },
    });
  } catch (error) {
    console.error('Error generating search result visualization:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate search result visualization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to generate search result visualizations',
    endpoints: {
      POST: {
        description: 'Generate search result visualizations and analytics',
        required: ['results', 'query'],
        optional: ['searchType', 'settings'],
      },
    },
  });
}
