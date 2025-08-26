import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface ServiceHealth {
  qdrant: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    url: string;
    collections?: any[];
    error?: string;
  };
  ollama: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    url: string;
    models?: string[];
    error?: string;
  };
}

export interface Config {
  qdrantUrl: string;
  ollamaUrl: string;
  logLevel: string;
  docReindexEnabled: boolean;
  docReindexInterval: number;
}

export interface UpdateConfigData {
  qdrantUrl: string;
  ollamaUrl: string;
}

export interface QdrantMetrics {
  status: string;
  collection: {
    name: string;
    status: string;
    points_count: number;
    segments_count: number;
    indexed_vectors_count: number;
    optimizer_status: string;
    config: {
      params: {
        vectors: {
          size: number;
          distance: string;
        };
        shard_number: number;
        replication_factor: number;
        on_disk_payload: boolean;
      };
      hnsw_config: {
        m: number;
        ef_construct: number;
        full_scan_threshold: number;
        max_indexing_threads: number;
        on_disk: boolean;
      };
      optimizer_config: {
        deleted_threshold: number;
        vacuum_min_vector_number: number;
        indexing_threshold: number;
        flush_interval_sec: number;
      };
      wal_config: {
        wal_capacity_mb: number;
        wal_segments_ahead: number;
      };
    };
    performance: {
      indexed_vectors_count: number;
      optimizer_status: string;
      indexing_progress: number;
      vectors_per_segment: number;
    };
  };
  performance_indicators: {
    indexing_efficiency: number;
    indexing_progress: number;
    vectors_per_segment: number;
    collection_health: {
      status: string;
      optimizer_status: string;
      total_vectors: number;
      total_segments: number;
    };
  };
}

export interface DashboardMetrics {
  overview: {
    projectsCount: number;
    totalQueries: number;
    activeProjects: number;
    documentationRepositoriesCount: number;
    activeDocumentationRepositories: number;
    totalDocuments: number;
    dbSize: number;
    vectorMetrics: {
      collectionExists: boolean;
      totalVectors: number;
      collectionSize: number;
      status: string;
      segments: number;
      indexedVectors: number;
      optimizerStatus: string;
      indexingProgress: number;
      vectorsPerSegment: number;
    };
  };
  projects: {
    total: number;
    statusBreakdown: Record<string, number>;
  };
  indexing: {
    totalJobs: number;
    totalDocumentationJobs: number;
    statusBreakdown: Record<string, number>;
    documentationStatusBreakdown: Record<string, number>;
  };
  content: {
    globalPreferences: number;
    totalVectors: number;
    documentationRepositories: number;
    totalDocuments: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'project' | 'documentation';
    projectName?: string;
    repositoryName?: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    progress: number;
    vectorsAdded?: number;
    documentsAdded?: number;
  }>;
  timestamp: string;
}

export interface LogLevel {
  value: string;
  label: string;
  description: string;
}

// Query keys
export const adminKeys = {
  all: ['admin'] as const,
  health: () => [...adminKeys.all, 'health'] as const,
  config: () => [...adminKeys.all, 'config'] as const,
  qdrantMetrics: () => [...adminKeys.all, 'qdrant-metrics'] as const,
  dashboardMetrics: () => [...adminKeys.all, 'dashboard-metrics'] as const,
  logLevels: () => [...adminKeys.all, 'log-levels'] as const,
  currentLogLevel: () => [...adminKeys.all, 'current-log-level'] as const,
};

// API functions
async function fetchServiceHealth(): Promise<ServiceHealth> {
  const response = await fetch('/api/admin/health', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch service health: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function fetchConfig(): Promise<Config> {
  const response = await fetch('/api/admin/config');
  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function updateConfig(configData: UpdateConfigData): Promise<Config> {
  // First get the current config to preserve other fields
  const currentConfig = await fetchConfig();
  
  // Merge the updates with the current config
  const fullConfig = {
    ...currentConfig,
    ...configData,
  };
  
  const response = await fetch('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullConfig),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update config');
  }
  
  // Return the updated config
  return fullConfig;
}

async function fetchQdrantMetrics(): Promise<QdrantMetrics> {
  const response = await fetch('/api/admin/qdrant-metrics');
  if (!response.ok) {
    throw new Error(`Failed to fetch Qdrant metrics: ${response.statusText}`);
  }
  const data = await response.json();
  
  // Return the rich metrics data with proper structure
  if (data.success && data.metrics) {
    return {
      status: data.metrics.collection?.status || 'unknown',
      collection: {
        name: 'ideamem_memory',
        status: data.metrics.collection?.status || 'unknown',
        points_count: data.metrics.collection?.points_count || 0,
        segments_count: data.metrics.collection?.segments_count || 0,
        indexed_vectors_count: data.metrics.collection?.indexed_vectors_count || 0,
        optimizer_status: data.metrics.collection?.optimizer_status || 'unknown',
        config: data.metrics.collection?.config || {},
        performance: data.metrics.collection?.performance || {
          indexed_vectors_count: 0,
          optimizer_status: 'unknown',
          indexing_progress: 0,
          vectors_per_segment: 0
        }
      },
      performance_indicators: data.metrics.performance_indicators || {
        indexing_efficiency: 0,
        indexing_progress: 0,
        vectors_per_segment: 0,
        collection_health: {
          status: 'unknown',
          optimizer_status: 'unknown',
          total_vectors: 0,
          total_segments: 0
        }
      }
    };
  }
  
  throw new Error('Invalid response format from Qdrant metrics API');
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await fetch('/api/dashboard/metrics');
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard metrics: ${response.statusText}`);
  }
  return response.json();
}

async function pullOllamaModel(modelName: string): Promise<void> {
  const response = await fetch('/api/admin/pull-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelName }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to pull model');
  }
}

async function fetchAvailableLogLevels(): Promise<LogLevel[]> {
  const response = await fetch('/api/admin/logging');
  if (!response.ok) {
    throw new Error(`Failed to fetch log levels: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch log levels');
  }
  return result.data.availableLevels;
}

async function fetchCurrentLogLevel(): Promise<string> {
  const response = await fetch('/api/admin/logging');
  if (!response.ok) {
    throw new Error(`Failed to fetch current log level: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch current log level');
  }
  return result.data.currentLevel;
}

async function updateLogLevel(level: string): Promise<void> {
  const response = await fetch('/api/admin/logging', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || 'Failed to update log level');
  }
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update log level');
  }
}

// Hooks
export function useServiceHealth() {
  return useQuery({
    queryKey: adminKeys.health(),
    queryFn: fetchServiceHealth,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useConfig() {
  return useQuery({
    queryKey: adminKeys.config(),
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.config() });
      queryClient.invalidateQueries({ queryKey: adminKeys.health() });
    },
  });
}

export function useQdrantMetrics() {
  return useQuery({
    queryKey: adminKeys.qdrantMetrics(),
    queryFn: fetchQdrantMetrics,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: adminKeys.dashboardMetrics(),
    queryFn: fetchDashboardMetrics,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time updates
  });
}

export function usePullOllamaModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: pullOllamaModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.health() });
    },
  });
}

export function useAvailableLogLevels() {
  return useQuery({
    queryKey: adminKeys.logLevels(),
    queryFn: fetchAvailableLogLevels,
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });
}

export function useCurrentLogLevel() {
  return useQuery({
    queryKey: adminKeys.currentLogLevel(),
    queryFn: fetchCurrentLogLevel,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUpdateLogLevel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateLogLevel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.currentLogLevel() });
    },
  });
}