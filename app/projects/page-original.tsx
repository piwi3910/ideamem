'use client';

import { useState, useEffect, useCallback } from 'react';
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
  XMarkIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  EyeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import SearchAutoComplete from '../../components/SearchAutoComplete';
import { SearchSuggestion } from '../../lib/search-suggestions';

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

interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
  type: string;
  projectId: string;
  projectName: string;
  language?: string;
  metadata?: Record<string, any>;
}


export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [indexingJobs, setIndexingJobs] = useState<Record<string, IndexingJob>>({});

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [searchHistory, setSearchHistory] = useState<
    Array<{ query: string; timestamp: Date; resultsCount: number }>
  >([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);

  // Form state for new project
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    gitRepo: '',
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
    } catch (_error) {
      console.error('Failed to load projects:', _error);
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
    const gitUrlPattern =
      /^(https?:\/\/)?([\w\.-]+@)?([\w\.-]+)(:\d+)?[\/:]([~\w\.-]|\/)*(\.git)?$/;
    return gitUrlPattern.test(url);
  };

  const createProject = async () => {
    if (!validateForm()) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
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

  const _deleteProject = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this project? This will also delete all indexed data.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
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
        method: 'POST',
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
        method: 'DELETE',
      });

      if (response.ok) {
        await loadProjects();
        await loadIndexingJobs();
      }
    } catch (error) {
      console.error('Failed to stop indexing:', error);
    }
  };

  // Search functionality
  const performSearch = useCallback(
    async (query: string, projectFilter?: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch('/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'memory.retrieve',
              arguments: {
                query,
                project_id: projectFilter || undefined,
                scope: 'all',
                filters: {},
              },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result && data.result.results) {
            const formattedResults: SearchResult[] = data.result.results.map(
              (result: any, index: number) => ({
                id: `result-${index}`,
                title: result.content?.slice(0, 100) + '...' || 'Untitled',
                content: result.content || '',
                score: result.score || 0,
                source: result.source || 'Unknown',
                type: result.type || 'text',
                projectId: result.project_id || '',
                projectName:
                  projects.find((p) => p.id === result.project_id)?.name || 'Unknown Project',
                language: result.language,
                metadata: result.metadata,
              })
            );

            setSearchResults(formattedResults);

            // Add to search history
            setSearchHistory((prev) => [
              {
                query,
                timestamp: new Date(),
                resultsCount: formattedResults.length,
              },
              ...prev.slice(0, 9),
            ]);
          }
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [projects]
  );

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
    setShowSearch(true);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    console.log('Selected suggestion:', suggestion);
  };

  const addToSavedSearches = (query: string) => {
    if (!savedSearches.includes(query)) {
      setSavedSearches((prev) => [query, ...prev]);
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
      case 'COMPLETED':
        return 'Indexed';
      case 'ERROR':
        return 'Failed';
      case 'INDEXING':
        return 'Indexing';
      default:
        return 'Idle';
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
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your repositories and indexing</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={twMerge(
              'btn flex items-center gap-2',
              showSearch ? 'btn-primary' : 'btn-secondary'
            )}
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            Search
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <SearchAutoComplete
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onSuggestionSelect={handleSuggestionSelect}
            placeholder="Search across all your projects..."
            searchHistory={searchHistory}
            popularTerms={[
              { term: 'function', count: 45 },
              { term: 'component', count: 32 },
              { term: 'interface', count: 28 },
              { term: 'class', count: 24 },
            ]}
            theme="light"
            className="mb-4"
          />

          {/* Quick filters */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Quick filters:</span>
            <button
              onClick={() => handleSearchSubmit('type:code')}
              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200"
            >
              Code
            </button>
            <button
              onClick={() => handleSearchSubmit('type:documentation')}
              className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200"
            >
              Docs
            </button>
            <button
              onClick={() => handleSearchSubmit('lang:typescript')}
              className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs hover:bg-purple-200"
            >
              TypeScript
            </button>
            <button
              onClick={() => handleSearchSubmit('lang:javascript')}
              className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200"
            >
              JavaScript
            </button>
          </div>
        </div>
      )}
        {/* Search Results */}
        {showSearch && searchQuery && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Search Results for "{searchQuery}"
                </h2>
                {isSearching && <ArrowPathIcon className="h-5 w-5 text-primary-600 animate-spin" />}
                <div className="text-sm text-gray-500">{searchResults.length} results found</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addToSavedSearches(searchQuery)}
                  className="btn btn-secondary text-sm flex items-center gap-1"
                  disabled={savedSearches.includes(searchQuery)}
                >
                  <BookmarkIcon className="h-4 w-4" />
                  {savedSearches.includes(searchQuery) ? 'Saved' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="card cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedResult(result)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {result.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {result.projectName}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                            {result.type}
                          </span>
                          {result.language && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                              {result.language}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <ChartBarIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {(result.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-3">
                      {result.content.slice(0, 200)}...
                    </p>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-500">Source: {result.source}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedResult(result);
                        }}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                      >
                        <EyeIcon className="h-3 w-3" />
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && !isSearching ? (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search query or check if your projects are indexed.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => handleSearchSubmit('type:code')}
                    className="btn btn-secondary text-sm"
                  >
                    Search Code
                  </button>
                  <button
                    onClick={() => handleSearchSubmit('type:documentation')}
                    className="btn btn-secondary text-sm"
                  >
                    Search Docs
                  </button>
                </div>
              </div>
            ) : null}

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Recent Searches</h3>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearchSubmit(item.query)}
                      className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span>"{item.query}"</span>
                      <span className="text-xs text-gray-500">({item.resultsCount})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {projects.length === 0 ? (
          // Empty State
          <div className="text-center py-16">
            <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first project to start indexing code repositories.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
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
                    <div className="flex items-center ml-4">{getStatusIcon(project)}</div>
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
                      <span
                        className={twMerge(
                          'text-sm font-medium',
                          getActualStatus(project) === 'COMPLETED' && 'text-green-600',
                          getActualStatus(project) === 'ERROR' && 'text-red-600',
                          getActualStatus(project) === 'INDEXING' && 'text-blue-600',
                          getActualStatus(project) === 'IDLE' && 'text-gray-500'
                        )}
                      >
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
                          {job.currentFile
                            ? `Processing: ${job.currentFile}`
                            : `${job.processedFiles}/${job.totalFiles} files`}
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
                  className={twMerge('input', formErrors.name && 'border-red-300')}
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
                  className={twMerge('input', formErrors.gitRepo && 'border-red-300')}
                  placeholder="https://github.com/user/repo.git"
                  value={newProject.gitRepo}
                  onChange={(e) => setNewProject({ ...newProject, gitRepo: e.target.value })}
                />
                {formErrors.gitRepo && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.gitRepo}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={createProject} className="btn btn-primary flex-1">
                Create Project
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Search Result Details Modal */}
      <Dialog open={selectedResult !== null} onClose={() => setSelectedResult(null)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {selectedResult && (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Dialog.Title className="text-xl font-semibold text-gray-900 truncate">
                        {selectedResult.title}
                      </Dialog.Title>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          {selectedResult.projectName}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                          {selectedResult.type}
                        </span>
                        {selectedResult.language && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded">
                            {selectedResult.language}
                          </span>
                        )}
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                          Score: {(selectedResult.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedResult(null)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Content</h3>
                    <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                      {selectedResult.content}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Source:</span>
                          <span className="font-medium">{selectedResult.source}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{selectedResult.type}</span>
                        </div>
                        {selectedResult.language && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Language:</span>
                            <span className="font-medium">{selectedResult.language}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Relevance:</span>
                          <span className="font-medium">
                            {(selectedResult.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedResult.metadata && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Metadata</h3>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm font-mono">
                          <pre>{JSON.stringify(selectedResult.metadata, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Link
                      href={`/projects/${selectedResult.projectId}`}
                      className="btn btn-primary flex items-center gap-2"
                      onClick={() => setSelectedResult(null)}
                    >
                      <FolderIcon className="h-4 w-4" />
                      View Project
                    </Link>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedResult.content);
                      }}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      Copy Content
                    </button>
                  </div>
                </div>
              </>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
