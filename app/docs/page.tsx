'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  ClockIcon,
  ArrowPathIcon,
  GlobeAltIcon,
  BookOpenIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import { 
  docRepositoryFormSchema, 
  docRepositoryUpdateFormSchema,
  type DocRepositoryFormData,
  type DocRepositoryUpdateFormData 
} from '@/lib/schemas/forms';

// Import React Query hooks and utility functions
import { 
  useDocumentationRepositories, 
  useCreateRepository, 
  useUpdateRepository, 
  useDeleteRepository,
  mapRepositoryForDisplay,
  mapRepositoryForAPI,
  getStatusIcon,
  getStatusColor,
  getSourceTypeIcon,
  getSourceTypeLabel,
  type DocumentationRepository,
  type DocRepository 
} from '@/hooks/use-documentation';



export default function DocsPage() {
  // React Query hooks
  const { data: rawRepositories = [], isLoading: loading, error: fetchError } = useDocumentationRepositories();
  const createRepoMutation = useCreateRepository();
  const updateRepoMutation = useUpdateRepository();
  const deleteRepoMutation = useDeleteRepository();
  
  // Map the repositories for display
  const repositories = rawRepositories.map(mapRepositoryForDisplay);
  
  // Local UI state
  const [editingRepo, setEditingRepo] = useState<DocRepository | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form hooks
  const addForm = useForm<DocRepositoryFormData>({
    resolver: zodResolver(docRepositoryFormSchema),
    defaultValues: {
      name: '',
      url: '',
      sourceType: 'git',
      branch: 'main',
      description: '',
      reindexInterval: 14,
      autoReindexEnabled: true,
    },
  });
  
  const editForm = useForm<DocRepositoryUpdateFormData>({
    resolver: zodResolver(docRepositoryUpdateFormSchema),
  });
  
  const error = fetchError?.message || createRepoMutation.error?.message || 
                updateRepoMutation.error?.message || deleteRepoMutation.error?.message || '';
  
  const saveMessage = createRepoMutation.isSuccess ? 
    `Repository "${createRepoMutation.data?.name}" added and indexing started automatically!` :
    updateRepoMutation.isSuccess ? 'Repository updated successfully' :
    deleteRepoMutation.isSuccess ? 'Repository deleted successfully' : '';

  const handleAddRepository = addForm.handleSubmit(async (data) => {
    createRepoMutation.mutate({
      url: data.url,
    }, {
      onSuccess: () => {
        addForm.reset();
        setShowAddForm(false);
      }
    });
  });

  const handleEditRepository = editForm.handleSubmit(async (data) => {
    if (!editingRepo) return;

    const apiData = mapRepositoryForAPI({
      ...editingRepo,
      ...data,
    });
    updateRepoMutation.mutate({
      ...apiData,
      id: editingRepo.id,
    }, {
      onSuccess: () => {
        setEditingRepo(null);
        editForm.reset();
      }
    });
  });

  const handleDeleteRepository = async (repo: DocRepository) => {
    if (
      !confirm(
        `Are you sure you want to delete "${repo.name}"? This will remove all indexed documentation from this repository.`
      )
    ) {
      return;
    }

    deleteRepoMutation.mutate(repo.id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
          <p className="text-gray-600 mt-1">
            Manage documentation repositories and sources
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add Repository
        </button>
      </div>

      
      {/* Documentation Sources Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Documentation Sources ({repositories.length})
        </h3>
      </div>

      {/* Add Repository Form */}
      {showAddForm && (
        <form onSubmit={handleAddRepository} className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Add Documentation Source</h4>
          <div className="space-y-4">
            <div>
              <label className="label">URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://github.com/facebook/react or https://example.com/llms.txt or https://docs.example.com"
                {...addForm.register('url')}
              />
              {addForm.formState.errors.url && (
                <span className="text-sm text-red-600">{addForm.formState.errors.url.message}</span>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <p className="text-xs text-blue-800 mb-2 font-medium">
                  Supported source types:
                </p>
                <div className="space-y-1 text-xs text-blue-700">
                  <div className="flex items-center gap-2">
                    <CodeBracketIcon className="h-3 w-3" />
                    <strong>Git repositories:</strong> GitHub, GitLab, etc. (e.g.,
                    https://github.com/facebook/react)
                  </div>
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-3 w-3" />
                    <strong>llms.txt files:</strong> AI-optimized docs (e.g.,
                    https://example.com/llms.txt)
                  </div>
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="h-3 w-3" />
                    <strong>Websites:</strong> Documentation sites (e.g.,
                    https://docs.example.com)
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <span>🤖</span>
                  The system automatically detects source type and extracts relevant
                  information.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={addForm.formState.isSubmitting}
              >
                Add Repository
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  addForm.reset();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {saveMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="text-green-700">{saveMessage}</span>
        </div>
      )}

      {/* Repositories List */}
      {loading ? (
        <div className="card">
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-500">Loading repositories...</div>
          </div>
        </div>
      ) : repositories.length === 0 ? (
        <div className="card">
          <div className="text-center py-8">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Documentation Sources</h3>
            <p className="text-gray-600 mb-4">
              Add your first documentation source to start building a comprehensive knowledge
              base.
            </p>
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add First Source
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {repositories.map((repo) => (
            <div key={repo.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    {getSourceTypeIcon(repo.sourceType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{repo.name}</h4>
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {getSourceTypeLabel(repo.sourceType)}
                      </span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(repo.status)}
                        <span
                          className={twMerge(
                            'text-sm font-medium',
                            getStatusColor(repo.status)
                          )}
                        >
                          {repo.status === 'completed' && `${repo.documentCount} docs`}
                          {repo.status === 'indexing' && 'Indexing...'}
                          {repo.status === 'error' && 'Error'}
                          {repo.status === 'pending' && 'Not indexed'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{repo.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        {getSourceTypeIcon(repo.sourceType)}
                        <span className="text-xs">{repo.gitUrl || repo.url}</span>
                      </span>
                      {repo.sourceType === 'git' && repo.branch && (
                        <span>Branch: {repo.branch}</span>
                      )}
                      {repo.lastIndexed && (
                        <span>
                          Last indexed: {new Date(repo.lastIndexed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {repo.languages.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {repo.languages.map((lang) => (
                          <span
                            key={lang}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                    {repo.lastError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        Error: {repo.lastError}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {repo.status === 'indexing' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Auto-indexing...</span>
                    </div>
                  )}
                  {repo.status === 'completed' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded text-sm">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>{repo.documentCount} docs indexed</span>
                    </div>
                  )}
                  {repo.status === 'error' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded text-sm">
                      <ExclamationCircleIcon className="h-4 w-4" />
                      <span>Indexing failed</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setEditingRepo({ ...repo });
                      editForm.reset({
                        name: repo.name,
                        url: repo.url || repo.gitUrl,
                        sourceType: repo.sourceType,
                        branch: repo.branch,
                        description: repo.description,
                        reindexInterval: repo.reindexInterval,
                        autoReindexEnabled: repo.autoReindexEnabled,
                      });
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit repository"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRepository(repo)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete repository"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {editingRepo && editingRepo.id === repo.id && (
                <form onSubmit={handleEditRepository} className="border-t border-gray-200 pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Source Name</label>
                      <input
                        type="text"
                        className="input"
                        {...editForm.register('name')}
                      />
                      {editForm.formState.errors.name && (
                        <span className="text-sm text-red-600">{editForm.formState.errors.name.message}</span>
                      )}
                    </div>
                    {editingRepo.sourceType === 'git' && (
                      <div>
                        <label className="label">Branch</label>
                        <input
                          type="text"
                          className="input"
                          {...editForm.register('branch')}
                        />
                        {editForm.formState.errors.branch && (
                          <span className="text-sm text-red-600">{editForm.formState.errors.branch.message}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">
                      {editingRepo.sourceType === 'git'
                        ? 'Git Repository URL'
                        : editingRepo.sourceType === 'llmstxt'
                          ? 'llms.txt File URL'
                          : 'Website URL'}
                    </label>
                    <input
                      type="url"
                      className="input"
                      {...editForm.register('url')}
                    />
                    {editForm.formState.errors.url && (
                      <span className="text-sm text-red-600">{editForm.formState.errors.url.message}</span>
                    )}
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input
                      type="text"
                      className="input"
                      {...editForm.register('description')}
                    />
                    {editForm.formState.errors.description && (
                      <span className="text-sm text-red-600">{editForm.formState.errors.description.message}</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={editForm.formState.isSubmitting}
                    >
                      Save Changes
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingRepo(null);
                        editForm.reset();
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}