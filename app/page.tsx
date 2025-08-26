'use client';

import Link from 'next/link';
import {
  FolderIcon,
  MagnifyingGlassIcon,
  ServerIcon,
  CpuChipIcon,
  ChartBarIcon,
  CircleStackIcon,
  ArrowPathIcon,
  QueueListIcon,
  CalendarIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import MetricCard from '@/components/MetricCard';
import RecentActivity from '@/components/RecentActivity';

// Import React Query hooks
import { useDashboardMetrics, useQdrantMetrics } from '@/hooks/use-admin';

// Qdrant Performance Metrics Component using React Query
function QdrantPerformanceSection() {
  const { data: metrics, isLoading: loading, error, refetch } = useQdrantMetrics();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <CpuChipIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Qdrant Performance Metrics</h3>
            <p className="text-sm text-gray-600">Vector database performance and optimization status</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      ) : metrics?.collection ? (
        <div className="space-y-6">
          {/* Collection Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Collection Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Status:</span>
                  <span className={`font-medium ${metrics.collection.status === 'green' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {metrics.collection.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Points:</span>
                  <span className="font-medium">{(metrics.collection.points_count || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Segments:</span>
                  <span className="font-medium">{metrics.collection.segments_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Optimizer:</span>
                  <span className={`font-medium ${metrics.collection.optimizer_status === 'ok' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {metrics.collection.optimizer_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Performance Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Indexing Progress:</span>
                  <span className="font-medium">{metrics.performance_indicators.indexing_progress.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Indexing Efficiency:</span>
                  <span className="font-medium">{(metrics.performance_indicators.indexing_efficiency * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Vectors/Segment:</span>
                  <span className="font-medium">{metrics.performance_indicators.vectors_per_segment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Indexed Vectors:</span>
                  <span className="font-medium">{(metrics.collection.indexed_vectors_count || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">Configuration</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-purple-700">Vector Size:</span>
                  <span className="font-medium">{metrics.collection.config?.params?.vectors?.size || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Distance:</span>
                  <span className="font-medium">{metrics.collection.config?.params?.vectors?.distance || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">Shards:</span>
                  <span className="font-medium">{metrics.collection.config?.params?.shard_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700">On Disk:</span>
                  <span className="font-medium">{metrics.collection.config?.params?.on_disk_payload ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">HNSW Configuration</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">M (connections):</span>
                  <span className="font-medium">{metrics.collection.config?.hnsw_config?.m || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">EF Construct:</span>
                  <span className="font-medium">{metrics.collection.config?.hnsw_config?.ef_construct || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Full Scan Threshold:</span>
                  <span className="font-medium">{(metrics.collection.config?.hnsw_config?.full_scan_threshold || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">On Disk:</span>
                  <span className="font-medium">{metrics.collection.config?.hnsw_config?.on_disk ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Optimizer Settings</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Deleted Threshold:</span>
                  <span className="font-medium">{((metrics.collection.config?.optimizer_config?.deleted_threshold || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Indexing Threshold:</span>
                  <span className="font-medium">{(metrics.collection.config?.optimizer_config?.indexing_threshold || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Flush Interval:</span>
                  <span className="font-medium">{metrics.collection.config?.optimizer_config?.flush_interval_sec || 0}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">WAL Capacity:</span>
                  <span className="font-medium">{metrics.collection.config?.wal_config?.wal_capacity_mb || 0}MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No Qdrant metrics available</p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  // React Query hooks for data fetching
  const { 
    data: metrics, 
    isLoading: loading, 
    error, 
    refetch: refetchMetrics 
  } = useDashboardMetrics();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <ExclamationCircleIcon className="h-8 w-8 text-red-500" />
          </div>
          <div className="text-red-600 mb-4">Error loading dashboard</div>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => refetchMetrics()}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Overview of your IdeaMem semantic memory system
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {metrics && (
            <span className="text-xs text-gray-500">
              Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
            </span>
          )}
          <Link href="/projects" className="btn btn-primary">
            Manage Projects
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Projects"
          value={metrics?.overview.projectsCount ?? 0}
          subtitle="Active repositories"
          icon={<FolderIcon className="h-6 w-6" />}
          color="blue"
          loading={loading}
        />
        
        <MetricCard
          title="Total Queries"
          value={metrics?.overview.totalQueries ?? 0}
          subtitle="Across all projects"
          icon={<MagnifyingGlassIcon className="h-6 w-6" />}
          color="green"
          loading={loading}
        />
        
        <MetricCard
          title="Vector Embeddings"
          value={metrics?.content.totalVectors ?? 0}
          subtitle="Semantic chunks"
          icon={<CpuChipIcon className="h-6 w-6" />}
          color="purple"
          loading={loading}
        />
        
        <MetricCard
          title="Database Size"
          value={metrics ? formatBytes(metrics.overview.dbSize) : '0 KB'}
          subtitle="SQLite + Vector DB"
          icon={<CircleStackIcon className="h-6 w-6" />}
          color="gray"
          loading={loading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Active Projects"
          value={metrics?.overview.activeProjects ?? 0}
          subtitle="Queried this week"
          icon={<ChartBarIcon className="h-6 w-6" />}
          color="yellow"
          loading={loading}
        />
        
        <MetricCard
          title="Documentation Repositories"
          value={metrics?.overview.documentationRepositoriesCount ?? 0}
          subtitle="Indexed documentation"
          icon={<ServerIcon className="h-6 w-6" />}
          color="blue"
          loading={loading}
        />
        
        <MetricCard
          title="Global Preferences"
          value={metrics?.content.globalPreferences ?? 0}
          subtitle="System constraints"
          icon={<CpuChipIcon className="h-6 w-6" />}
          color="green"
          loading={loading}
        />
      </div>

      {/* Qdrant Performance Metrics */}
      <QdrantPerformanceSection />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Vector Database</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                metrics?.overview.vectorMetrics.collectionExists
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {metrics?.overview.vectorMetrics.collectionExists ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Collection Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                metrics?.overview.vectorMetrics.status === 'green'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {metrics?.overview.vectorMetrics.status || 'Unknown'}
              </span>
            </div>

            {/* Performance Metrics */}
            {metrics?.overview.vectorMetrics.segments && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Segments</span>
                <span className="text-xs text-gray-500">
                  {metrics.overview.vectorMetrics.segments} segments
                </span>
              </div>
            )}

            {metrics?.overview.vectorMetrics.indexingProgress && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Indexing Progress</span>
                <span className="text-xs text-gray-500">
                  {metrics.overview.vectorMetrics.indexingProgress.toFixed(1)}%
                </span>
              </div>
            )}

            {metrics?.overview.vectorMetrics.optimizerStatus && metrics.overview.vectorMetrics.optimizerStatus !== 'unknown' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Optimizer</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  metrics.overview.vectorMetrics.optimizerStatus === 'ok'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {metrics.overview.vectorMetrics.optimizerStatus}
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm text-gray-600 mb-2">Quick Actions</div>
              <div className="space-y-2">
                <Link
                  href="/admin"
                  className="block w-full text-center py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700"
                >
                  System Configuration
                </Link>
                <Link
                  href="/test-mcp"
                  className="block w-full text-center py-2 px-3 bg-purple-100 hover:bg-purple-200 rounded text-sm font-medium text-purple-700"
                >
                  Test MCP Protocol
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h3>
          <div className="space-y-3">
            {metrics && Object.entries(metrics.projects.statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">
                  {status.toLowerCase().replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                  status === 'INDEXING' ? 'bg-blue-100 text-blue-800' :
                  status === 'ERROR' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {count}
                </span>
              </div>
            ))}
            
            <div className="pt-2 border-t border-gray-200">
              <Link
                href="/projects"
                className="block w-full text-center py-2 px-3 bg-blue-100 hover:bg-blue-200 rounded text-sm font-medium text-blue-700"
              >
                Manage All Projects
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <RecentActivity
            activities={metrics?.recentActivity ?? []}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}