'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';

interface Rule {
  id: string;
  version: number;
  score?: number;
  payload: {
    content: string;
    source: string;
    type: 'rule';
    language: 'markdown';
    scope: 'global';
    project_id: 'global';
  };
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState({ source: '', content: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/global/rules');
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.source.trim() || !newRule.content.trim()) {
      setError('Source and content are required');
      return;
    }

    try {
      const response = await fetch('/api/global/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: newRule.source,
          content: newRule.content,
          type: 'rule',
          language: 'markdown',
        }),
      });

      if (!response.ok) throw new Error('Failed to add rule');

      setSaveMessage('Rule added successfully');
      setNewRule({ source: '', content: '' });
      setShowAddForm(false);
      await fetchRules();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add rule');
    }
  };

  const handleEditRule = async (rule: Rule) => {
    if (!editingRule) return;

    try {
      const response = await fetch('/api/global/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          source: editingRule.payload.source,
          content: editingRule.payload.content,
        }),
      });

      if (!response.ok) throw new Error('Failed to update rule');

      setSaveMessage('Rule updated successfully');
      setEditingRule(null);
      await fetchRules();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const handleDeleteRule = async (rule: Rule) => {
    if (!confirm(`Are you sure you want to delete the rule from "${rule.payload.source}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/global/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: rule.payload.source }),
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      setSaveMessage('Rule deleted successfully');
      await fetchRules();

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const renderRuleContent = (content: string) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-primary-600">
                  IdeaMem
                </Link>
                <p className="text-gray-600 mt-1">Global Rules Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/preferences" className="btn btn-secondary">
                User Preferences
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <GlobeAltIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Global Coding Rules</h2>
                <p className="text-gray-600 mb-4">
                  Manage universal coding standards, style guides, and architectural constraints
                  that apply across all projects. These rules are used by the MCP validation tools
                  to ensure code consistency and prevent common mistakes.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Priority:</strong> Project-specific rules always override global rules.
                    Global rules serve as fallbacks when no project-specific rules exist.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add Rule Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Current Rules ({rules.length})</h3>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add New Rule
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddForm && (
            <div className="card">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Rule</h4>
              <div className="space-y-4">
                <div>
                  <label className="label">Source Identifier</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g., typescript-standards, react-best-practices"
                    value={newRule.source}
                    onChange={(e) => setNewRule({ ...newRule, source: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier for this rule set. Use kebab-case naming.
                  </p>
                </div>
                <div>
                  <label className="label">Rule Content (Markdown)</label>
                  <textarea
                    className="input min-h-[200px] font-mono text-sm"
                    placeholder={`# Rule Title

## Section 1
- Rule item 1
- Rule item 2

## Section 2
- More rules here`}
                    value={newRule.content}
                    onChange={(e) => setNewRule({ ...newRule, content: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use markdown formatting. These rules will be searchable by the MCP validation
                    tools.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAddRule} className="btn btn-primary">
                    Save Rule
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewRule({ source: '', content: '' });
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

          {/* Rules List */}
          {loading ? (
            <div className="card">
              <div className="text-center py-8">
                <div className="animate-pulse text-gray-500">Loading rules...</div>
              </div>
            </div>
          ) : rules.length === 0 ? (
            <div className="card">
              <div className="text-center py-8">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Rules Found</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first coding rule.</p>
                <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add First Rule
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{rule.payload.source}</h4>
                        <p className="text-sm text-gray-500">
                          Version {rule.version} • Global Scope
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingRule({ ...rule })}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit rule"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete rule"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {editingRule && editingRule.id === rule.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="label">Source Identifier</label>
                        <input
                          type="text"
                          className="input"
                          value={editingRule.payload.source}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              payload: { ...editingRule.payload, source: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Content</label>
                        <textarea
                          className="input min-h-[200px] font-mono text-sm"
                          value={editingRule.payload.content}
                          onChange={(e) =>
                            setEditingRule({
                              ...editingRule,
                              payload: { ...editingRule.payload, content: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleEditRule(rule)} className="btn btn-primary">
                          Save Changes
                        </button>
                        <button onClick={() => setEditingRule(null)} className="btn btn-secondary">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      {renderRuleContent(rule.payload.content)}
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
