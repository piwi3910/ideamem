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
import QdrantPerformanceSection from '@/components/QdrantPerformanceSection';

// Import React Query hooks
import { useDashboardMetrics } from '@/hooks/use-admin';

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