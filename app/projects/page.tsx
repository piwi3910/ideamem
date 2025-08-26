'use client';

import { useState } from 'react';
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

// Import our new hooks and stores
import { 
  useProjects, 
  useCreateProject, 
  useDeleteProject, 
  useStartIndexing,
  useProjectIndexingJobs,
  type CreateProjectData 
} from '@/hooks/use-projects';
import { useSearch, type SearchResult } from '@/hooks/use-search';
import { useUIStore } from '@/store/ui-store';
import SearchAutoComplete from '../../components/SearchAutoComplete';
import ProjectIndexingStatus from '../../components/ProjectIndexingStatus';

export default function ProjectsPage() {
  // React Query hooks for data fetching
  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const startIndexingMutation = useStartIndexing();
  const searchMutation = useSearch();

  // Zustand store for UI state
  const {
    createProjectModalOpen,
    deleteProjectModalOpen,
    selectedProjectId,
    searchPanelOpen,
    searchHistory,
    savedSearches,
    openCreateProjectModal,
    closeCreateProjectModal,
    openDeleteProjectModal,
    closeDeleteProjectModal,
    toggleSearchPanel,
    addToSearchHistory,
    saveSearch,
    removeSavedSearch,
  } = useUIStore();

  // Local component state (only for form data)
  const [newProject, setNewProject] = useState<CreateProjectData>({
    name: '',
    description: '',
    gitRepo: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Derive search state from the mutation
  const searchResults = searchMutation.data?.results || [];
  const isSearching = searchMutation.isPending;

  // Form validation
  const validateForm = (): boolean => {
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

  const isValidGitUrl = (url: string): boolean => {
    const gitUrlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return gitUrlPattern.test(url) && (url.includes('github') || url.includes('gitlab') || url.includes('bitbucket') || url.includes('.git'));
  };

  // Create project handler
  const handleCreateProject = async () => {
    if (!validateForm()) return;

    try {
      await createProjectMutation.mutateAsync(newProject);
      
      // Reset form and close modal
      setNewProject({ name: '', description: '', gitRepo: '' });
      setFormErrors({});
      closeCreateProjectModal();
    } catch (error) {
      console.error('Failed to create project:', error);
      setFormErrors({ submit: error instanceof Error ? error.message : 'Failed to create project' });
    }
  };

  // Delete project handler
  const handleDeleteProject = async () => {
    if (!selectedProjectId) return;

    try {
      await deleteProjectMutation.mutateAsync(selectedProjectId);
      closeDeleteProjectModal();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // Start indexing handler
  const handleStartIndexing = async (projectId: string, fullReindex = false) => {
    try {
      await startIndexingMutation.mutateAsync({ projectId, fullReindex });
    } catch (error) {
      console.error('Failed to start indexing:', error);
    }
  };

  // Search handler
  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    searchMutation.mutate(
      { query: searchQuery, limit: 10 },
      {
        onSuccess: (data) => {
          addToSearchHistory(searchQuery, data.results?.length || 0);
        },
        onError: (error) => {
          console.error('Search failed:', error);
        },
      }
    );
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
          <h3 className="ml-2 text-sm font-medium text-red-800">
            Failed to load projects
          </h3>
        </div>
        <div className="mt-2">
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
          >
            Try again
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            Manage your indexed codebases ({projects.length} projects)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleSearchPanel}
            className="btn btn-secondary flex items-center gap-2"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
          </button>
          <button
            onClick={openCreateProjectModal}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Project
          </button>
        </div>
      </div>

      {/* Search Panel */}
      {searchPanelOpen && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Search Projects</h3>
            <button
              onClick={toggleSearchPanel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <SearchAutoComplete
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearch}
                onSuggestionSelect={(suggestion) => setSearchQuery(suggestion.text)}
                placeholder="Search across all projects..."
                className="w-full"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="btn btn-primary disabled:opacity-50"
            >
              {isSearching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Results ({searchResults.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedResult(result)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{result.source}</div>
                      <div className="text-xs text-gray-500">{result.projectName}</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {result.content.substring(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
          <p className="mt-2 text-gray-500">Get started by adding your first project.</p>
          <button
            onClick={openCreateProjectModal}
            className="mt-4 btn btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                    )}
                    <p className="text-xs text-gray-500">{project.gitRepo}</p>
                  </div>
                  <button
                    onClick={() => openDeleteProjectModal(project.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Project Stats */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-4">
                    <span>{project.fileCount || 0} files</span>
                    <span>{project.vectorCount || 0} vectors</span>
                  </div>
                  <ProjectIndexingStatus project={project} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartIndexing(project.id, false)}
                      disabled={startIndexingMutation.isPending}
                      className="btn btn-sm btn-secondary flex items-center gap-1"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Index
                    </button>
                    <button
                      onClick={() => handleStartIndexing(project.id, true)}
                      disabled={startIndexingMutation.isPending}
                      className="btn btn-sm btn-secondary flex items-center gap-1"
                    >
                      <ArrowPathIcon className="h-3 w-3" />
                      Reindex
                    </button>
                  </div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    <EyeIcon className="h-3 w-3" />
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Dialog open={createProjectModalOpen} onClose={closeCreateProjectModal}>
        <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold">
                Add New Project
              </Dialog.Title>
              <button
                onClick={closeCreateProjectModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Project Name *</label>
                <input
                  type="text"
                  className={`input ${formErrors.name ? 'border-red-300' : ''}`}
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="My Awesome Project"
                />
                {formErrors.name && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-20"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Optional project description..."
                />
              </div>

              <div>
                <label className="label">Git Repository URL *</label>
                <input
                  type="url"
                  className={`input ${formErrors.gitRepo ? 'border-red-300' : ''}`}
                  value={newProject.gitRepo}
                  onChange={(e) => setNewProject({ ...newProject, gitRepo: e.target.value })}
                  placeholder="https://github.com/user/repo.git"
                />
                {formErrors.gitRepo && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.gitRepo}</p>
                )}
              </div>

              {formErrors.submit && (
                <p className="text-red-600 text-sm">{formErrors.submit}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeCreateProjectModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={createProjectMutation.isPending}
                className="btn btn-primary"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Project Modal */}
      <Dialog open={deleteProjectModalOpen} onClose={closeDeleteProjectModal}>
        <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-red-600">
                Delete Project
              </Dialog.Title>
              <button
                onClick={closeDeleteProjectModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this project? This action cannot be undone and will remove all indexed data.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteProjectModal}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleteProjectMutation.isPending}
                className="btn btn-danger"
              >
                {deleteProjectMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Project'
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}