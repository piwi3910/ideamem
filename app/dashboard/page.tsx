'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import {
  PlusIcon,
  FolderIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

interface Project {
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
  // Query metrics
  totalQueries?: number;
  lastQueryAt?: string;
  queriesThisWeek?: number;
  queriesThisMonth?: number;
  // Webhook information
  webhookEnabled?: boolean;
  lastWebhookAt?: string;
  lastWebhookCommit?: string;
  lastWebhookBranch?: string;
  lastWebhookAuthor?: string;
}

interface IndexingJob {
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
  progress: number;
  currentFile?: string;
  totalFiles: number;
  processedFiles: number;
  vectorCount?: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [indexingJobs, setIndexingJobs] = useState<Record<string, IndexingJob>>({});

  // Form state for new project
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    gitRepo: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load projects on component mount
  useEffect(() => {
    loadProjects();
    // Poll for indexing updates every 2 seconds
    const jobsInterval = setInterval(loadIndexingJobs, 2000);
    // Also refresh projects every 10 seconds to ensure status stays in sync
    const projectsInterval = setInterval(loadProjects, 10000);
    return () => {
      clearInterval(jobsInterval);
      clearInterval(projectsInterval);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadIndexingJobs = async () => {
    try {
      const response = await fetch('/api/projects/indexing/status');
      if (response.ok) {
        const data = await response.json();
        setIndexingJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to load indexing jobs:', error);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!newProject.name.trim()) {
      errors.name = 'Project name is required';
    }
    
    if (!newProject.gitRepo.trim()) {
      errors.gitRepo = 'Git repository URL is required';
    } else if (!isValidGitUrl(newProject.gitRepo)) {
      errors.gitRepo = 'Please enter a valid Git repository URL';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidGitUrl = (url: string) => {
    const gitUrlPattern = /^(https?:\/\/)?([\w\.-]+@)?([\w\.-]+)(:\d+)?[\/:]([~\w\.-]|\/)*(\.git)?$/;
    return gitUrlPattern.test(url);
  };

  const createProject = async () => {
    if (!validateForm()) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject)
      });

      if (response.ok) {
        await loadProjects();
        setShowCreateModal(false);
        setNewProject({ name: '', description: '', gitRepo: '' });
        setFormErrors({});
      } else {
        const error = await response.json();
        setFormErrors({ general: error.message || 'Failed to create project' });
      }
    } catch (error) {
      setFormErrors({ general: 'Network error occurred' });
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? This will also delete all indexed data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const startIndexing = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'POST'
      });

      if (response.ok) {
        await loadProjects();
        await loadIndexingJobs();
      }
    } catch (error) {
      console.error('Failed to start indexing:', error);
    }
  };

  const stopIndexing = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadProjects();
        await loadIndexingJobs();
      }
    } catch (error) {
      console.error('Failed to stop indexing:', error);
    }
  };


  const getActualStatus = (project: Project) => {
    // If project thinks it's indexing but there's no active job, it must be completed
    if (project.indexStatus === 'INDEXING' && !indexingJobs[project.id]) {
      return 'COMPLETED';
    }
    return project.indexStatus;
  };

  const getStatusIcon = (project: Project) => {
    const actualStatus = getActualStatus(project);
    switch (actualStatus) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'ERROR':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      case 'INDEXING':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (project: Project) => {
    const actualStatus = getActualStatus(project);
    switch (actualStatus) {
      case 'COMPLETED': return 'Indexed';
      case 'ERROR': return 'Failed';
      case 'INDEXING': return 'Indexing';
      default: return 'Idle';
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-primary-600">
                IdeaMem
              </Link>
              <p className="text-gray-600 mt-1">Project Management Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <Link href="/rules" className="btn btn-secondary text-sm">
                  Rules
                </Link>
                <Link href="/preferences" className="btn btn-secondary text-sm">
                  Preferences
                </Link>
                <Link href="/docs" className="btn btn-secondary text-sm">
                  Docs
                </Link>
                <Link href="/admin" className="btn btn-secondary text-sm">
                  Admin
                </Link>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {projects.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">Create your first project to start indexing code repositories.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create First Project
            </button>
          </div>
        ) : (
          // Projects Grid
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((project) => {
              const job = indexingJobs[project.id];
              return (
                <div key={project.id} className="card">
                  {/* Project Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/projects/${project.id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-primary-600 truncate block"
                      >
                        {project.name}
                      </Link>
                      {project.description && (
                        <p className="text-gray-600 text-sm mt-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center ml-4">
                      {getStatusIcon(project)}
                    </div>
                  </div>

                  {/* Git Repository */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 font-medium">Repository</p>
                    <p className="text-sm text-gray-900 truncate">{project.gitRepo}</p>
                  </div>

                  {/* Status and Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className={twMerge(
                        "text-sm font-medium",
                        getActualStatus(project) === 'COMPLETED' && 'text-green-600',
                        getActualStatus(project) === 'ERROR' && 'text-red-600',
                        getActualStatus(project) === 'INDEXING' && 'text-blue-600',
                        (getActualStatus(project) === 'IDLE') && 'text-gray-500'
                      )}>
                        {getStatusText(project)}
                      </span>
                    </div>
                    
                    {getActualStatus(project) === 'INDEXING' && job && (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          {job.currentFile ? `Processing: ${job.currentFile}` : `${job.processedFiles}/${job.totalFiles} files`}
                        </p>
                      </div>
                    )}

                    {getActualStatus(project) === 'COMPLETED' && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Files: {project.fileCount || 0}</span>
                        <span>Vectors: {project.vectorCount || 0}</span>
                      </div>
                    )}

                    {getActualStatus(project) === 'ERROR' && project.lastError && (
                      <p className="text-sm text-red-600 mt-1">{project.lastError}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                    {getActualStatus(project) === 'INDEXING' ? (
                      <button
                        onClick={() => stopIndexing(project.id)}
                        className="btn bg-red-100 text-red-700 hover:bg-red-200 flex-1 flex items-center justify-center gap-1"
                      >
                        <StopIcon className="h-4 w-4" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => startIndexing(project.id)}
                        className="btn bg-green-100 text-green-700 hover:bg-green-200 flex-1 flex items-center justify-center gap-1"
                      >
                        <PlayIcon className="h-4 w-4" />
                        {getActualStatus(project) === 'COMPLETED' ? 'Reindex' : 'Index'}
                      </button>
                    )}
                    
                    <Link
                      href={`/projects/${project.id}`}
                      className="btn btn-secondary flex items-center gap-1"
                    >
                      <FolderIcon className="h-4 w-4" />
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Create New Project
            </Dialog.Title>
            
            {formErrors.general && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{formErrors.general}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Project Name</label>
                <input
                  type="text"
                  className={twMerge("input", formErrors.name && "border-red-300")}
                  placeholder="My Awesome Project"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
                {formErrors.name && <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="label">Description (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Brief description of the project..."
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Git Repository URL</label>
                <input
                  type="url"
                  className={twMerge("input", formErrors.gitRepo && "border-red-300")}
                  placeholder="https://github.com/user/repo.git"
                  value={newProject.gitRepo}
                  onChange={(e) => setNewProject({ ...newProject, gitRepo: e.target.value })}
                />
                {formErrors.gitRepo && <p className="text-sm text-red-600 mt-1">{formErrors.gitRepo}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                className="btn btn-primary flex-1"
              >
                Create Project
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

    </div>
  );
}