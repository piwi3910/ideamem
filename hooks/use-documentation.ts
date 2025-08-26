import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

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

// Display interface that matches the existing UI
export interface DocRepository {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  gitUrl?: string;
  url?: string;
  branch?: string;
  description?: string;
  languages: string[];
  lastIndexed?: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  documentCount: number;
  lastError?: string;
}

// Mapping and utility functions
export function mapRepositoryForDisplay(repo: DocumentationRepository): DocRepository {
  const status = repo.indexingProgress > 0 && repo.indexingProgress < 100 ? 'indexing' :
                 repo.lastError ? 'error' :
                 repo.totalDocuments > 0 ? 'completed' : 'pending';
  
  return {
    id: repo.id,
    name: repo.name,
    sourceType: repo.type,
    gitUrl: repo.type === 'git' ? repo.url : undefined,
    url: repo.type !== 'git' ? repo.url : undefined,
    branch: repo.metadata?.branch,
    description: repo.description,
    languages: repo.languages,
    lastIndexed: repo.lastIndexedAt,
    status,
    documentCount: repo.totalDocuments,
    lastError: repo.lastError,
  };
}

export function mapRepositoryForAPI(repo: DocRepository): Partial<DocumentationRepository> {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    url: repo.gitUrl || repo.url || '',
    languages: repo.languages,
    metadata: repo.branch ? { branch: repo.branch } : undefined,
  };
}

export function getStatusIcon(status: 'pending' | 'indexing' | 'completed' | 'error'): React.ReactElement {
  const className = 'h-5 w-5';
  switch (status) {
    case 'completed':
      return React.createElement(CheckCircleIcon, { className: twMerge(className, 'text-green-500') });
    case 'error':
      return React.createElement(ExclamationCircleIcon, { className: twMerge(className, 'text-red-500') });
    case 'indexing':
      return React.createElement(ArrowPathIcon, { className: twMerge(className, 'text-blue-500 animate-spin') });
    default:
      return React.createElement(ClockIcon, { className: twMerge(className, 'text-gray-400') });
  }
}

export function getStatusColor(status: 'pending' | 'indexing' | 'completed' | 'error'): string {
  switch (status) {
    case 'completed':
      return 'text-green-600';
    case 'error':
      return 'text-red-600';
    case 'indexing':
      return 'text-blue-600';
    default:
      return 'text-gray-500';
  }
}

export function getSourceTypeIcon(sourceType: 'git' | 'llmstxt' | 'website'): React.ReactElement {
  const className = 'h-5 w-5 text-indigo-600';
  switch (sourceType) {
    case 'git':
      return React.createElement(CodeBracketIcon, { className });
    case 'llmstxt':
      return React.createElement(DocumentTextIcon, { className });
    case 'website':
      return React.createElement(GlobeAltIcon, { className });
    default:
      return React.createElement(BookOpenIcon, { className });
  }
}

export function getSourceTypeLabel(sourceType: 'git' | 'llmstxt' | 'website'): string {
  switch (sourceType) {
    case 'git':
      return 'Git Repository';
    case 'llmstxt':
      return 'llms.txt File';
    case 'website':
      return 'Website';
    default:
      return 'Documentation Source';
  }
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