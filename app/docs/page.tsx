'use client';

import { useState } from 'react';
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

// Import React Query hooks
import { useDocumentationRepositories, useCreateRepository, useUpdateRepository, useDeleteRepository, type DocumentationRepository } from '@/hooks/use-documentation';

// Define display interface that matches the existing UI
interface DocRepository {
  id: string;
  name: string;
  sourceType: 'git' | 'llmstxt' | 'website';
  gitUrl?: string;
  url?: string;
  branch?: string;
  description?: string;
  languages: string[];
  lastIndexed?: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  documentCount: number;
  lastError?: string;
}

// Map backend DocumentationRepository to display DocRepository
function mapRepositoryForDisplay(repo: DocumentationRepository): DocRepository {
  const status = repo.indexingProgress > 0 && repo.indexingProgress < 100 ? 'indexing' :
                 repo.lastError ? 'error' :
                 repo.totalDocuments > 0 ? 'completed' : 'pending';
  
  return {
    id: repo.id,
    name: repo.name,
    sourceType: repo.type,
    gitUrl: repo.type === 'git' ? repo.url : undefined,
    url: repo.type !== 'git' ? repo.url : undefined,
    branch: repo.metadata?.branch,
    description: repo.description,
    languages: repo.languages,
    lastIndexed: repo.lastIndexedAt,
    status,
    documentCount: repo.totalDocuments,
    lastError: repo.lastError,
  };
}

// Map display DocRepository back to DocumentationRepository for updates
function mapRepositoryForAPI(repo: DocRepository): Partial<DocumentationRepository> {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description,
    url: repo.gitUrl || repo.url || '',
    languages: repo.languages,
    metadata: repo.branch ? { branch: repo.branch } : undefined,
  };
}


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
  const [newRepo, setNewRepo] = useState({
    url: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  
  const error = fetchError?.message || createRepoMutation.error?.message || 
                updateRepoMutation.error?.message || deleteRepoMutation.error?.message || '';
  
  const saveMessage = createRepoMutation.isSuccess ? 
    `Repository "${createRepoMutation.data?.name}" added and indexing started automatically!` :
    updateRepoMutation.isSuccess ? 'Repository updated successfully' :
    deleteRepoMutation.isSuccess ? 'Repository deleted successfully' : '';

  const handleAddRepository = async () => {
    if (!newRepo.url.trim()) {
      return;
    }

    createRepoMutation.mutate({
      url: newRepo.url,
    }, {
      onSuccess: () => {
        setNewRepo({ url: '' });
        setShowAddForm(false);
      }
    });
  };

  const handleEditRepository = async (repo: DocRepository) => {
    if (!editingRepo) return;

    const apiData = mapRepositoryForAPI(editingRepo);
    updateRepoMutation.mutate({
      ...apiData,
      id: repo.id,
    }, {
      onSuccess: () => {
        setEditingRepo(null);
      }
    });
  };

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

  const getStatusIcon = (status: 'pending' | 'indexing' | 'completed' | 'error') => {
    const className = 'h-5 w-5';
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className={twMerge(className, 'text-green-500')} />;
      case 'error':
        return <ExclamationCircleIcon className={twMerge(className, 'text-red-500')} />;
      case 'indexing':
        return <ArrowPathIcon className={twMerge(className, 'text-blue-500 animate-spin')} />;
      default:
        return <ClockIcon className={twMerge(className, 'text-gray-400')} />;
    }
  };

  const getStatusColor = (status: 'pending' | 'indexing' | 'completed' | 'error') => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'indexing':
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  const getSourceTypeIcon = (sourceType: 'git' | 'llmstxt' | 'website') => {
    const className = 'h-5 w-5 text-indigo-600';
    switch (sourceType) {
      case 'git':
        return <CodeBracketIcon className={className} />;
      case 'llmstxt':
        return <DocumentTextIcon className={className} />;
      case 'website':
        return <GlobeAltIcon className={className} />;
      default:
        return <BookOpenIcon className={className} />;
    }
  };

  const getSourceTypeLabel = (sourceType: 'git' | 'llmstxt' | 'website') => {
    switch (sourceType) {
      case 'git':
        return 'Git Repository';
      case 'llmstxt':
        return 'llms.txt File';
      case 'website':
        return 'Website';
      default:
        return 'Documentation Source';
    }
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
        <div className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Add Documentation Source</h4>
          <div className="space-y-4">
            <div>
              <label className="label">URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://github.com/facebook/react or https://example.com/llms.txt or https://docs.example.com"
                value={newRepo.url}
                onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
              />
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
              <button onClick={handleAddRepository} className="btn btn-primary">
                Add Repository
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewRepo({ url: '' });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
                    onClick={() => setEditingRepo({ ...repo })}
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
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Source Name</label>
                      <input
                        type="text"
                        className="input"
                        value={editingRepo.name}
                        onChange={(e) =>
                          setEditingRepo({ ...editingRepo, name: e.target.value })
                        }
                      />
                    </div>
                    {editingRepo.sourceType === 'git' && (
                      <div>
                        <label className="label">Branch</label>
                        <input
                          type="text"
                          className="input"
                          value={editingRepo.branch || ''}
                          onChange={(e) =>
                            setEditingRepo({ ...editingRepo, branch: e.target.value })
                          }
                        />
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
                      value={editingRepo.gitUrl || editingRepo.url || ''}
                      onChange={(e) => {
                        if (editingRepo.sourceType === 'git') {
                          setEditingRepo({ ...editingRepo, gitUrl: e.target.value });
                        } else {
                          setEditingRepo({ ...editingRepo, url: e.target.value });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input
                      type="text"
                      className="input"
                      value={editingRepo.description || ''}
                      onChange={(e) =>
                        setEditingRepo({ ...editingRepo, description: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Primary Languages/Technologies</label>
                    <input
                      type="text"
                      className="input"
                      value={editingRepo.languages.join(', ')}
                      onChange={(e) =>
                        setEditingRepo({
                          ...editingRepo,
                          languages: e.target.value
                            .split(',')
                            .map((l) => l.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditRepository(repo)}
                      className="btn btn-primary"
                    >
                      Save Changes
                    </button>
                    <button onClick={() => setEditingRepo(null)} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}