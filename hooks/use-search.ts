import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Types
export interface SearchResult {
  id: string;
  content: string;
  source: string;
  type: string;
  project?: string;
  score: number;
  metadata?: any;
}

export interface SearchParams {
  query: string;
  limit?: number;
  filters?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount?: number;
  searchTime?: number;
}

// Query keys
export const searchKeys = {
  all: ['search'] as const,
  results: (query: string, params?: Omit<SearchParams, 'query'>) => 
    [...searchKeys.all, 'results', query, params] as const,
};

// API functions
async function performSearch(params: SearchParams): Promise<SearchResponse> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query,
      limit: params.limit || 10,
      filters: params.filters,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    totalCount: data.totalCount,
    searchTime: data.searchTime,
  };
}

// Hooks
export function useSearch() {
  return useMutation({
    mutationFn: performSearch,
    // Don't retry search requests as they are user-initiated
    retry: false,
  });
}

// Optional: For saved/cached search results
export function useSearchResults(query: string, params?: Omit<SearchParams, 'query'>) {
  return useQuery({
    queryKey: searchKeys.results(query, params),
    queryFn: () => performSearch({ query, ...params }),
    enabled: !!query.trim(),
    staleTime: 30 * 1000, // 30 seconds - searches can become stale quickly
    // Don't cache empty or very short queries
    gcTime: query.trim().length < 3 ? 0 : 5 * 60 * 1000, // 5 minutes for valid queries
  });
}