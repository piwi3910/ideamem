import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SearchFacetsEngine, FacetFilters } from '../../../../lib/search-facets';
import { withValidation } from '@/lib/middleware/validation';

const facetSearchSchema = z.object({
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional().default({}),
  projectId: z.string().optional(),
});

const facetQuerySchema = z.object({
  query: z.string().optional(),
  projectId: z.string().optional(),
});

export const POST = withValidation(
  { body: facetSearchSchema },
  async (_request: NextRequest, { body: { query, filters, projectId } }) => {
    try {
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
);

export const GET = withValidation(
  { query: facetQuerySchema },
  async (_request: NextRequest, { query: { query, projectId } }) => {
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
);
