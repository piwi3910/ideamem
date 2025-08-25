'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  DocumentTextIcon,
  CogIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

interface Preference {
  id: string;
  version: number;
  score?: number;
  payload: {
    content: string;
    source: string;
    type: 'user_preference';
    language: 'markdown';
    scope: 'global';
    project_id: 'global';
  };
}

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null);
  const [newPreference, setNewPreference] = useState({ source: '', content: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/global/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      setPreferences(data.preferences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPreference = async () => {
    if (!newPreference.source.trim() || !newPreference.content.trim()) {
      setError('Source and content are required');
      return;
    }

    try {
      const response = await fetch('/api/global/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: newPreference.source,
          content: newPreference.content,
          type: 'user_preference',
          language: 'markdown',
        }),
      });

      if (!response.ok) throw new Error('Failed to add preference');

      setSaveMessage('Preference added successfully');
      setNewPreference({ source: '', content: '' });
      setShowAddForm(false);
      await fetchPreferences();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add preference');
    }
  };

  const handleEditPreference = async (preference: Preference) => {
    if (!editingPreference) return;

    try {
      const response = await fetch('/api/global/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: preference.id,
          source: editingPreference.payload.source,
          content: editingPreference.payload.content,
        }),
      });

      if (!response.ok) throw new Error('Failed to update preference');

      setSaveMessage('Preference updated successfully');
      setEditingPreference(null);
      await fetchPreferences();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preference');
    }
  };

  const handleDeletePreference = async (preference: Preference) => {
    if (
      !confirm(`Are you sure you want to delete the preference "${preference.payload.source}"?`)
    ) {
      return;
    }

    try {
      const response = await fetch('/api/global/preferences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: preference.payload.source }),
      });

      if (!response.ok) throw new Error('Failed to delete preference');

      setSaveMessage('Preference deleted successfully');
      await fetchPreferences();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preference');
    }
  };

  const renderPreferenceContent = (content: string) => {
    // Simple markdown-like rendering for display
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return (
          <h2 key={index} className="text-lg font-semibold text-gray-900 mt-4 mb-2">
            {line.substring(2)}
          </h2>
        );
      } else if (line.startsWith('## ')) {
        return (
          <h3 key={index} className="text-md font-medium text-gray-800 mt-3 mb-1">
            {line.substring(3)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        return (
          <li key={index} className="text-sm text-gray-600 ml-4">
            {line.substring(2)}
          </li>
        );
      } else if (line.trim()) {
        return (
          <p key={index} className="text-sm text-gray-600 mb-1">
            {line}
          </p>
        );
      } else {
        return <br key={index} />;
      }
    });
  };

  const getPreferenceIcon = (source: string) => {
    if (source.includes('tool') || source.includes('environment')) {
      return <CogIcon className="h-5 w-5 text-purple-600" />;
    } else if (source.includes('communication') || source.includes('workflow')) {
      return <UserCircleIcon className="h-5 w-5 text-blue-600" />;
    } else {
      return <DocumentTextIcon className="h-5 w-5 text-green-600" />;
    }
  };

  const getPreferenceColor = (source: string) => {
    if (source.includes('tool') || source.includes('environment')) {
      return 'bg-purple-100';
    } else if (source.includes('communication') || source.includes('workflow')) {
      return 'bg-blue-100';
    } else {
      return 'bg-green-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserCircleIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-primary-600">
                  IdeaMem
                </Link>
                <p className="text-gray-600 mt-1">Global User Preferences</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/rules" className="btn btn-secondary">
                Rules
              </Link>
              <Link href="/docs" className="btn btn-secondary">
                Documentation
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <GlobeAltIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Global User Preferences
                </h2>
                <p className="text-gray-600 mb-4">
                  Configure universal development preferences, tooling choices, and workflow
                  settings that apply across all projects. These preferences guide development
                  decisions and tool configurations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CogIcon className="h-5 w-5 text-purple-600" />
                      <h4 className="font-medium text-purple-900">Tooling</h4>
                    </div>
                    <p className="text-sm text-purple-700">
                      IDE settings, linter configs, package managers, and development tools
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCircleIcon className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-blue-900">Workflow</h4>
                    </div>
                    <p className="text-sm text-blue-700">
                      Git workflows, code review processes, and communication preferences
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DocumentTextIcon className="h-5 w-5 text-green-600" />
                      <h4 className="font-medium text-green-900">Formatting</h4>
                    </div>
                    <p className="text-sm text-green-700">
                      Code style, file encoding, and documentation preferences
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Preference Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Current Preferences ({preferences.length})
            </h3>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add New Preference
            </button>
          </div>

          {/* Add Preference Form */}
          {showAddForm && (
            <div className="card">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Preference</h4>
              <div className="space-y-4">
                <div>
                  <label className="label">Source Identifier</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., global-tooling-preferences, development-workflow"
                    value={newPreference.source}
                    onChange={(e) => setNewPreference({ ...newPreference, source: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this preference set. Use kebab-case naming.
                  </p>
                </div>
                <div>
                  <label className="label">Preference Content (Markdown)</label>
                  <textarea
                    className="input min-h-[200px] font-mono text-sm"
                    placeholder={`# Preference Category

## Tool Preferences
- Preferred package manager: pnpm
- Code formatter: Prettier
- Linter: ESLint

## Workflow Preferences
- Git commit format: Conventional Commits
- Branch naming: feature/issue-number-description`}
                    value={newPreference.content}
                    onChange={(e) =>
                      setNewPreference({ ...newPreference, content: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use markdown formatting. These preferences will be used by development tools and
                    AI assistants.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAddPreference} className="btn btn-primary">
                    Save Preference
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPreference({ source: '', content: '' });
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

          {/* Preferences List */}
          {loading ? (
            <div className="card">
              <div className="text-center py-8">
                <div className="animate-pulse text-gray-500">Loading preferences...</div>
              </div>
            </div>
          ) : preferences.length === 0 ? (
            <div className="card">
              <div className="text-center py-8">
                <UserCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Preferences Found</h3>
                <p className="text-gray-600 mb-4">
                  Get started by adding your first user preference.
                </p>
                <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add First Preference
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {preferences.map((preference) => (
                <div key={preference.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={twMerge(
                          'p-2 rounded-lg',
                          getPreferenceColor(preference.payload.source)
                        )}
                      >
                        {getPreferenceIcon(preference.payload.source)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{preference.payload.source}</h4>
                        <p className="text-sm text-gray-500">
                          Version {preference.version} • Global Scope
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPreference({ ...preference })}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit preference"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePreference(preference)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete preference"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {editingPreference && editingPreference.id === preference.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="label">Source Identifier</label>
                        <input
                          type="text"
                          className="input"
                          value={editingPreference.payload.source}
                          onChange={(e) =>
                            setEditingPreference({
                              ...editingPreference,
                              payload: { ...editingPreference.payload, source: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Content</label>
                        <textarea
                          className="input min-h-[200px] font-mono text-sm"
                          value={editingPreference.payload.content}
                          onChange={(e) =>
                            setEditingPreference({
                              ...editingPreference,
                              payload: { ...editingPreference.payload, content: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEditPreference(preference)}
                          className="btn btn-primary"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingPreference(null)}
                          className="btn btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      {renderPreferenceContent(preference.payload.content)}
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
