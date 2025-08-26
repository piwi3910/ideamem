import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  PlayIcon 
} from '@heroicons/react/24/outline';

interface ActivityItem {
  id: string;
  type: 'project' | 'documentation';
  projectName?: string;
  repositoryName?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  startedAt: string;
  completedAt?: string | null;
  progress: number;
  vectorsAdded?: number;
  documentsAdded?: number;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const statusConfig = {
  PENDING: { icon: ClockIcon, color: 'text-gray-500', bg: 'bg-gray-100' },
  RUNNING: { icon: PlayIcon, color: 'text-blue-500', bg: 'bg-blue-100' },
  COMPLETED: { icon: CheckCircleIcon, color: 'text-green-500', bg: 'bg-green-100' },
  FAILED: { icon: XCircleIcon, color: 'text-red-500', bg: 'bg-red-100' },
  CANCELLED: { icon: XCircleIcon, color: 'text-gray-500', bg: 'bg-gray-100' }
};

export default function RecentActivity({ activities, loading = false }: RecentActivityProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 mb-4 last:mb-0">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <p className="text-sm text-gray-500 mt-1">Latest indexing jobs and updates</p>
      </div>
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const config = statusConfig[activity.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const Icon = config.icon;
              
              return (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`p-2 rounded-full ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.type === 'project' ? activity.projectName : activity.repositoryName}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(activity.startedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        activity.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        activity.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' :
                        activity.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.status.toLowerCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {activity.type === 'project' ? 'Project' : 'Documentation'} Indexing
                      </span>
                      {activity.status === 'RUNNING' && (
                        <span className="text-xs text-gray-500">
                          {activity.progress}% complete
                        </span>
                      )}
                      {activity.status === 'COMPLETED' && (
                        <span className="text-xs text-gray-500">
                          {activity.type === 'project' && activity.vectorsAdded ? 
                            `+${activity.vectorsAdded.toLocaleString()} vectors` : 
                            activity.type === 'documentation' && activity.documentsAdded ?
                            `+${activity.documentsAdded.toLocaleString()} docs` : ''
                          }
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}