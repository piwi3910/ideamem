'use client';

import {
  CpuChipIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Import React Query hooks
import { useQdrantMetrics } from '@/hooks/use-admin';

export default function QdrantPerformanceSection() {
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