'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@headlessui/react';
import { projectFormSchema, type ProjectFormData } from '@/lib/schemas/forms';
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
import { useUIStore } from '@/store/ui-store';
import ProjectIndexingStatus from '../../components/ProjectIndexingStatus';

export default function ProjectsPage() {
  // React Query hooks for data fetching
  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const startIndexingMutation = useStartIndexing();

  // Zustand store for UI state
  const {
    createProjectModalOpen,
    deleteProjectModalOpen,
    selectedProjectId,
    openCreateProjectModal,
    closeCreateProjectModal,
    openDeleteProjectModal,
    closeDeleteProjectModal,
  } = useUIStore();

  // Local component state
  
  // Form hook for create project
  const createForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      gitRepo: '',
    },
  });



  // Create project handler
  const handleCreateProject = createForm.handleSubmit(async (data) => {
    try {
      await createProjectMutation.mutateAsync(data);
      
      // Reset form and close modal
      createForm.reset();
      closeCreateProjectModal();
    } catch (error) {
      console.error('Failed to create project:', error);
      createForm.setError('root', {
        message: error instanceof Error ? error.message : 'Failed to create project',
      });
    }
  });

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
            onClick={openCreateProjectModal}
            className="btn btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Project
          </button>
        </div>
      </div>


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
                  <button
                    onClick={() => handleStartIndexing(project.id, project.indexStatus === 'COMPLETED')}
                    disabled={startIndexingMutation.isPending}
                    className="btn btn-sm btn-secondary flex items-center gap-1"
                  >
                    {project.indexStatus === 'COMPLETED' ? (
                      <>
                        <ArrowPathIcon className="h-3 w-3" />
                        Reindex
                      </>
                    ) : (
                      <>
                        <PlayIcon className="h-3 w-3" />
                        Index
                      </>
                    )}
                  </button>
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

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="label">Project Name *</label>
                <input
                  type="text"
                  className={`input ${createForm.formState.errors.name ? 'border-red-300' : ''}`}
                  {...createForm.register('name')}
                  placeholder="My Awesome Project"
                />
                {createForm.formState.errors.name && (
                  <p className="text-red-600 text-sm mt-1">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-20"
                  {...createForm.register('description')}
                  placeholder="Optional project description..."
                />
                {createForm.formState.errors.description && (
                  <p className="text-red-600 text-sm mt-1">{createForm.formState.errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="label">Git Repository URL *</label>
                <input
                  type="url"
                  className={`input ${createForm.formState.errors.gitRepo ? 'border-red-300' : ''}`}
                  {...createForm.register('gitRepo')}
                  placeholder="https://github.com/user/repo.git"
                />
                {createForm.formState.errors.gitRepo && (
                  <p className="text-red-600 text-sm mt-1">{createForm.formState.errors.gitRepo.message}</p>
                )}
              </div>

              {createForm.formState.errors.root && (
                <p className="text-red-600 text-sm">{createForm.formState.errors.root.message}</p>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeCreateProjectModal}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending || createForm.formState.isSubmitting}
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
            </form>
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