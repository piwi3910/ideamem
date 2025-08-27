'use client';

import { useProjectIndexingJobs } from '@/hooks/use-projects';

interface Project {
  id: string;
  indexStatus: string;
}

interface ProjectIndexingStatusProps {
  project: Project;
}

export default function ProjectIndexingStatus({ project }: ProjectIndexingStatusProps) {
  const { data: indexingJobs = [] } = useProjectIndexingJobs(project.id);
  
  // Ensure indexingJobs is an array
  const jobs = Array.isArray(indexingJobs) ? indexingJobs : [];
  const currentJob = jobs.find((job: any) => job.status === 'RUNNING');
  
  if (currentJob) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-blue-600">
          Indexing {currentJob.progress}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${
        project.indexStatus === 'COMPLETED' ? 'bg-green-500' :
        project.indexStatus === 'ERROR' ? 'bg-red-500' : 'bg-gray-400'
      }`} />
      <span className="text-sm text-gray-600 capitalize">
        {project.indexStatus.toLowerCase()}
      </span>
    </div>
  );
}