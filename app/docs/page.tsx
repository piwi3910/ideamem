'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

export default function DocsPage() {
  const [repositories, setRepositories] = useState<DocRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRepo, setEditingRepo] = useState<DocRepository | null>(null);
  const [newRepo, setNewRepo] = useState({
    url: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchRepositories();

    // Poll for status updates every 3 seconds to show real-time progress
    const interval = setInterval(fetchRepositories, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/global/docs/repositories');
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const data = await response.json();
      setRepositories(data.repositories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepository = async () => {
    if (!newRepo.url.trim()) {
      setError('URL is required');
      return;
    }

    try {
      const response = await fetch('/api/global/docs/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newRepo.url,
        }),
      });

      if (!response.ok) throw new Error('Failed to add repository');

      const data = await response.json();
      setSaveMessage(
        `${data.repository.sourceType === 'git' ? 'Repository' : data.repository.sourceType === 'llmstxt' ? 'llms.txt file' : 'Website'} "${data.repository.name}" added and indexing started automatically!`
      );
      setNewRepo({ url: '' });
      setShowAddForm(false);
      await fetchRepositories();

      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    }
  };

  const handleEditRepository = async (repo: DocRepository) => {
    if (!editingRepo) return;

    try {
      const response = await fetch('/api/global/docs/repositories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingRepo,
          id: repo.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to update repository');

      setSaveMessage('Repository updated successfully');
      setEditingRepo(null);
      await fetchRepositories();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update repository');
    }
  };

  const handleDeleteRepository = async (repo: DocRepository) => {
    if (
      !confirm(
        `Are you sure you want to delete "${repo.name}"? This will remove all indexed documentation from this repository.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch('/api/global/docs/repositories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: repo.id }),
      });

      if (!response.ok) throw new Error('Failed to delete repository');

      setSaveMessage('Repository deleted successfully');
      await fetchRepositories();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  // Auto-indexing is now handled automatically when repositories are added

  const getStatusIcon = (status: DocRepository['status']) => {
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

  const getStatusColor = (status: DocRepository['status']) => {
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

  const getSourceTypeIcon = (sourceType: DocRepository['sourceType']) => {
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

  const getSourceTypeLabel = (sourceType: DocRepository['sourceType']) => {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BookOpenIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-primary-600">
                  IdeaMem
                </Link>
                <p className="text-gray-600 mt-1">Documentation Repository Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/rules" className="btn btn-secondary">
                Rules
              </Link>
              <Link href="/preferences" className="btn btn-secondary">
                Preferences
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Introduction */}
          <div className="card">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <GlobeAltIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Documentation Sources</h2>
                <p className="text-gray-600 mb-4">
                  Manage documentation sources including Git repositories, llms.txt files, and
                  websites containing comprehensive, up-to-date documentation for languages,
                  frameworks, and modules. The MCP client can request documentation from these
                  indexed sources to provide accurate, current information.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">How it works</h4>
                      <p className="text-sm text-blue-800">
                        Add documentation sources: Git repositories (README, API docs), llms.txt
                        files (AI-optimized docs), or websites (documentation sites). The system
                        will fetch, parse, and index the content using our multi-format parser
                        system. MCP clients can then query this indexed knowledge for accurate,
                        current information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Add Repository Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Documentation Sources ({repositories.length})
            </h3>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Source
            </button>
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
      </main>
    </div>
  );
}
