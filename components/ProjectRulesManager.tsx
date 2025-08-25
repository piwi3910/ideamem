'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

interface Rule {
  id: string;
  score?: number;
  payload: {
    content: string;
    source: string;
    type: 'rule';
    language: 'markdown';
    scope: 'project';
    project_id: string;
  };
}

interface ProjectRulesManagerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectRulesManager({ projectId, isOpen, onClose }: ProjectRulesManagerProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRule, setNewRule] = useState({ source: '', content: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (isOpen && projectId) {
      fetchRules();
    }
  }, [isOpen, projectId]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/projects/${projectId}/rules`);
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (source: string, content: string, isEdit: boolean = false) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/rules`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, content }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save rule');
      }

      setSaveMessage(isEdit ? 'Rule updated successfully!' : 'Rule added successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      
      setEditingRule(null);
      setShowAddForm(false);
      setNewRule({ source: '', content: '' });
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    }
  };

  const handleDelete = async (source: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/rules?source=${encodeURIComponent(source)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete rule');
      }

      setSaveMessage('Rule deleted successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-6 w-6 text-blue-600 mr-3" />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Project Rules & Standards
              </Dialog.Title>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Status Messages */}
            {saveMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-700">{saveMessage}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {/* Header with Add Button */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Project-Specific Rules
                </h2>
                <p className="text-sm text-gray-600">
                  These rules override global rules and apply only to this project
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Rule
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading rules...</p>
              </div>
            ) : (
              <>
                {/* Add New Rule Form */}
                {showAddForm && (
                  <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h3 className="font-medium text-gray-900 mb-4">Add New Rule</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source Name
                        </label>
                        <input
                          type="text"
                          value={newRule.source}
                          onChange={(e) => setNewRule({ ...newRule, source: e.target.value })}
                          placeholder="e.g., project-typescript-rules, team-testing-standards"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rule Content (Markdown)
                        </label>
                        <textarea
                          value={newRule.content}
                          onChange={(e) => setNewRule({ ...newRule, content: e.target.value })}
                          rows={8}
                          placeholder="# Project-Specific TypeScript Rules&#10;&#10;- Use strict null checks&#10;- Prefer interfaces over types&#10;- All functions must have return types"
                          className="input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(newRule.source, newRule.content)}
                          disabled={!newRule.source || !newRule.content}
                          className="btn btn-primary"
                        >
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

                {/* Rules List */}
                {rules.length === 0 ? (
                  <div className="text-center py-12">
                    <ShieldCheckIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Rules</h3>
                    <p className="text-gray-500 mb-4">
                      This project is using global rules only. Add project-specific rules to override them.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rules.map((rule) => (
                      <div key={rule.id} className="border border-gray-200 rounded-lg">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {rule.payload.source}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Project Rule
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingRule(rule)}
                                className="p-2 text-gray-400 hover:text-blue-600"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(rule.payload.source)}
                                className="p-2 text-gray-400 hover:text-red-600"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap text-sm text-gray-700">
                              {rule.payload.content}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Dialog.Panel>
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <Dialog open={true} onClose={() => setEditingRule(null)} className="relative z-60">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
              <div className="p-6">
                <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                  Edit Rule: {editingRule.payload.source}
                </Dialog.Title>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Content (Markdown)
                    </label>
                    <textarea
                      value={editingRule.payload.content}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          payload: { ...editingRule.payload, content: e.target.value },
                        })
                      }
                      rows={12}
                      className="input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleSave(editingRule.payload.source, editingRule.payload.content, true)
                      }
                      className="btn btn-primary"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingRule(null)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}