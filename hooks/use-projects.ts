import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, createQueryFn, createMutationFn } from '@/lib/api-client';

// Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  gitRepo: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string;
  indexStatus: 'IDLE' | 'INDEXING' | 'COMPLETED' | 'ERROR';
  indexProgress?: number;
  fileCount?: number;
  vectorCount?: number;
  lastError?: string;
  totalQueries?: number;
  lastQueryAt?: string;
  queriesThisWeek?: number;
  queriesThisMonth?: number;
  webhookEnabled?: boolean;
  lastWebhookAt?: string;
  lastWebhookCommit?: string;
  lastWebhookBranch?: string;
  lastWebhookAuthor?: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  gitRepo: string;
}

export interface IndexingJob {
  id: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  filesProcessed?: number;
  vectorsAdded?: number;
  lastError?: string;
}

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  indexingJobs: (projectId: string) => [...projectKeys.detail(projectId), 'indexing-jobs'] as const,
  search: (query: string) => [...projectKeys.all, 'search', query] as const,
};

// API functions using the new API client
const fetchProjects = async (): Promise<Project[]> => {
  const data = await api.get<{ projects: Project[] }>('/api/projects');
  return data.projects || [];
};

const fetchProject = async (id: string): Promise<Project> => {
  const data = await api.get<{ project: Project }>(`/api/projects/${id}`);
  return data.project;
};

const createProject = async (projectData: CreateProjectData): Promise<Project> => {
  const data = await api.post<{ project: Project }>('/api/projects', projectData);
  return data.project;
};

const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/api/projects/${id}`);
};

const startIndexing = async (projectId: string, fullReindex = false): Promise<IndexingJob> => {
  const data = await api.post<{ job: IndexingJob }>(
    `/api/projects/${projectId}/index`,
    { fullReindex }
  );
  return data.job;
};

const fetchIndexingJobs = async (projectId: string): Promise<IndexingJob[]> => {
  const data = await api.get<{ jobs: IndexingJob[] }>(
    `/api/projects/indexing/status?projectId=${projectId}`
  );
  return data.jobs || [];
};

// Hooks
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: fetchProjects,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useProjectIndexingJobs(projectId: string) {
  return useQuery({
    queryKey: projectKeys.indexingJobs(projectId),
    queryFn: () => fetchIndexingJobs(projectId),
    enabled: !!projectId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0, // Always consider stale for real-time updates
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: (_, projectId) => {
      // Remove the deleted project from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useStartIndexing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, fullReindex }: { projectId: string; fullReindex?: boolean }) =>
      startIndexing(projectId, fullReindex),
    onSuccess: (_, { projectId }) => {
      // Invalidate project details and indexing jobs
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.indexingJobs(projectId) });
    },
  });
}

async function stopIndexing(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/index`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to stop indexing: ${response.statusText}`);
  }
}

export function useStopIndexing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (projectId: string) => stopIndexing(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.indexingJobs(projectId) });
    },
  });
}

async function regenerateToken(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/token`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to regenerate token: ${response.statusText}`);
  }
}

export function useRegenerateToken() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (projectId: string) => regenerateToken(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

async function fetchIndexingJob(projectId: string): Promise<IndexingJob | null> {
  const response = await fetch(`/api/projects/indexing/status?projectId=${projectId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch indexing job: ${response.statusText}`);
  }
  const data = await response.json();
  // Return the first job for this specific project, or null if no jobs
  const jobs = data.jobs || [];
  return jobs.length > 0 ? jobs[0] : null;
}

export function useIndexingJob(projectId: string) {
  return useQuery({
    queryKey: [...projectKeys.detail(projectId), 'indexing-job'],
    queryFn: () => fetchIndexingJob(projectId),
    enabled: !!projectId,
    refetchInterval: 2000, // Poll every 2 seconds
    staleTime: 0, // Always consider stale for real-time updates
  });
}