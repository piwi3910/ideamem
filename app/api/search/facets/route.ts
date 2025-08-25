import { NextRequest, NextResponse } from 'next/server';
import { SearchFacetsEngine, FacetFilters } from '../../../../lib/search-facets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters = {}, projectId } = body;

    console.log('Generating facets for search:', { query, filters, projectId });

    // Generate facets based on current query and filters
    const facetAnalysis = await SearchFacetsEngine.generateFacets(
      query,
      filters as FacetFilters,
      projectId
    );

    console.log('Generated facets:', {
      facetsCount: facetAnalysis.facets.length,
      totalDocuments: facetAnalysis.totalDocuments,
      filteredDocuments: facetAnalysis.filteredDocuments,
      suggestions: facetAnalysis.suggestions.length,
    });

    return NextResponse.json(facetAnalysis);
  } catch (error) {
    console.error('Error generating search facets:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate search facets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || undefined;
  const projectId = searchParams.get('projectId') || undefined;

  try {
    // Generate facets for GET request (no filters applied)
    const facetAnalysis = await SearchFacetsEngine.generateFacets(query, {}, projectId);

    return NextResponse.json(facetAnalysis);
  } catch (error) {
    console.error('Error generating search facets:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate search facets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
