import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface DocumentationRepository {
  id: string;
  name: string;
  description?: string;
  url: string;
  type: 'git' | 'llmstxt' | 'website';
  languages: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastIndexedAt?: string;
  totalDocuments: number;
  indexingProgress: number;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface CreateRepositoryData {
  url: string;
}

export interface DocumentationIndexingJob {
  id: string;
  repositoryId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  documentsProcessed?: number;
  documentsAdded?: number;
  lastError?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  source: string;
  repository: string;
  language?: string;
  metadata?: Record<string, any>;
}

export interface SearchFilters {
  languages?: string[];
  repositories?: string[];
  content_types?: string[];
  complexity?: string[];
  freshness?: {
    min?: number;
    max?: number;
  };
}

export interface FacetedSearchResult {
  results: SearchResult[];
  total: number;
  facets: {
    languages: Array<{ value: string; count: number }>;
    repositories: Array<{ value: string; count: number }>;
    content_types: Array<{ value: string; count: number }>;
    complexity: Array<{ value: string; count: number }>;
  };
  suggestions?: string[];
}

export interface RelationshipGraph {
  nodes: Array<{
    id: string;
    name: string;
    type: 'document' | 'repository' | 'topic';
    size: number;
    color: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    strength: number;
    type: 'similarity' | 'reference' | 'category';
  }>;
}

// Query keys
export const documentationKeys = {
  all: ['documentation'] as const,
  repositories: () => [...documentationKeys.all, 'repositories'] as const,
  repository: (id: string) => [...documentationKeys.all, 'repository', id] as const,
  indexingJobs: (repositoryId: string) => [...documentationKeys.repository(repositoryId), 'indexing-jobs'] as const,
  search: (query: string, filters?: SearchFilters) => [...documentationKeys.all, 'search', query, filters] as const,
  facetedSearch: (query: string, filters?: SearchFilters) => [...documentationKeys.all, 'faceted-search', query, filters] as const,
  relationshipGraph: () => [...documentationKeys.all, 'relationship-graph'] as const,
  relatedDocuments: (documentId: string) => [...documentationKeys.all, 'related', documentId] as const,
};

// API functions
async function fetchRepositories(): Promise<DocumentationRepository[]> {
  const response = await fetch('/api/global/docs/repositories');
  if (!response.ok) {
    throw new Error(`Failed to fetch repositories: ${response.statusText}`);
  }
  const data = await response.json();
  return data.repositories || [];
}

async function createRepository(repositoryData: CreateRepositoryData): Promise<DocumentationRepository> {
  const response = await fetch('/api/global/docs/repositories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(repositoryData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create repository');
  }
  
  const data = await response.json();
  return data.repository;
}

async function updateRepository(repositoryData: Partial<DocumentationRepository> & { id: string }): Promise<DocumentationRepository> {
  const response = await fetch('/api/global/docs/repositories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(repositoryData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update repository');
  }
  
  const data = await response.json();
  return data.repository;
}

async function deleteRepository(repositoryId: string): Promise<void> {
  const response = await fetch('/api/global/docs/repositories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: repositoryId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete repository');
  }
}

async function startRepositoryIndexing(repositoryId: string): Promise<DocumentationIndexingJob> {
  const response = await fetch(`/api/global/docs/repositories/${repositoryId}/index`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start indexing');
  }
  
  const data = await response.json();
  return data.job;
}

async function fetchIndexingJobs(repositoryId: string): Promise<DocumentationIndexingJob[]> {
  const response = await fetch(`/api/global/docs/repositories/${repositoryId}/jobs`);
  if (!response.ok) {
    throw new Error(`Failed to fetch indexing jobs: ${response.statusText}`);
  }
  const data = await response.json();
  return data.jobs || [];
}

async function searchDocumentation(
  query: string, 
  filters?: SearchFilters,
  limit = 10
): Promise<{ results: SearchResult[]; total: number }> {
  const searchParams = new URLSearchParams({
    query,
    limit: limit.toString(),
  });
  
  if (filters?.languages?.length) {
    searchParams.append('language_filter', filters.languages.join(','));
  }
  if (filters?.repositories?.length) {
    searchParams.append('repository_filter', filters.repositories.join(','));
  }
  
  const response = await fetch(`/api/global/docs/search?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return {
    results: data.results || [],
    total: data.total || 0,
  };
}

async function facetedSearchDocumentation(
  query: string,
  filters?: SearchFilters
): Promise<FacetedSearchResult> {
  const response = await fetch('/api/global/docs/faceted-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      filters: filters || {},
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Faceted search failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function fetchRelationshipGraph(): Promise<RelationshipGraph> {
  const response = await fetch('/api/global/docs/relationship-graph');
  if (!response.ok) {
    throw new Error(`Failed to fetch relationship graph: ${response.statusText}`);
  }
  return response.json();
}

async function fetchRelatedDocuments(documentId: string): Promise<SearchResult[]> {
  const response = await fetch(`/api/global/docs/related/${documentId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch related documents: ${response.statusText}`);
  }
  const data = await response.json();
  return data.documents || [];
}

// Hooks
export function useDocumentationRepositories() {
  return useQuery({
    queryKey: documentationKeys.repositories(),
    queryFn: fetchRepositories,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCreateRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentationKeys.repositories() });
    },
  });
}

export function useUpdateRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentationKeys.repositories() });
    },
  });
}

export function useDeleteRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentationKeys.repositories() });
    },
  });
}

export function useStartRepositoryIndexing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: startRepositoryIndexing,
    onSuccess: (_, repositoryId) => {
      queryClient.invalidateQueries({ queryKey: documentationKeys.repositories() });
      queryClient.invalidateQueries({ queryKey: documentationKeys.indexingJobs(repositoryId) });
    },
  });
}

export function useRepositoryIndexingJobs(repositoryId: string) {
  return useQuery({
    queryKey: documentationKeys.indexingJobs(repositoryId),
    queryFn: () => fetchIndexingJobs(repositoryId),
    enabled: !!repositoryId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0, // Always consider stale for real-time updates
  });
}

export function useSearchDocumentation(query: string, filters?: SearchFilters, limit = 10) {
  return useQuery({
    queryKey: documentationKeys.search(query, filters),
    queryFn: () => searchDocumentation(query, filters, limit),
    enabled: !!query.trim(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useFacetedSearchDocumentation(query: string, filters?: SearchFilters) {
  return useQuery({
    queryKey: documentationKeys.facetedSearch(query, filters),
    queryFn: () => facetedSearchDocumentation(query, filters),
    enabled: !!query.trim(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useRelationshipGraph() {
  return useQuery({
    queryKey: documentationKeys.relationshipGraph(),
    queryFn: fetchRelationshipGraph,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRelatedDocuments(documentId: string) {
  return useQuery({
    queryKey: documentationKeys.relatedDocuments(documentId),
    queryFn: () => fetchRelatedDocuments(documentId),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}