'use client';

import { useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';

// Import React Query hooks
import {
  useProjectPreferences,
  useCreateProjectPreference,
  useUpdateProjectPreference,
  useDeleteProjectPreference,
  type Preference,
} from '@/hooks/use-project-preferences';

interface ProjectPreferencesManagerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectPreferencesManager({ projectId, isOpen, onClose }: ProjectPreferencesManagerProps) {
  // React Query hooks
  const { data: preferences = [], isLoading: loading, error: fetchError } = useProjectPreferences(projectId);
  const createPreferenceMutation = useCreateProjectPreference(projectId);
  const updatePreferenceMutation = useUpdateProjectPreference(projectId);
  const deletePreferenceMutation = useDeleteProjectPreference(projectId);

  // Local UI state
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null);
  const [newPreference, setNewPreference] = useState({ source: '', content: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Derive error and success messages from mutations
  const error = fetchError?.message || createPreferenceMutation.error?.message || 
                updatePreferenceMutation.error?.message || deletePreferenceMutation.error?.message || '';
                
  const saveMessage = createPreferenceMutation.isSuccess ? 'Preference added successfully!' :
                     updatePreferenceMutation.isSuccess ? 'Preference updated successfully!' :
                     deletePreferenceMutation.isSuccess ? 'Preference deleted successfully!' : '';

  const handleSave = async (source: string, content: string, isEdit: boolean = false) => {
    if (isEdit) {
      updatePreferenceMutation.mutate({ source, content }, {
        onSuccess: () => {
          setEditingPreference(null);
        }
      });
    } else {
      createPreferenceMutation.mutate({ source, content }, {
        onSuccess: () => {
          setShowAddForm(false);
          setNewPreference({ source: '', content: '' });
        }
      });
    }
  };

  const handleDelete = async (source: string) => {
    if (!confirm('Are you sure you want to delete this preference?')) return;
    deletePreferenceMutation.mutate(source);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center">
              <CogIcon className="h-6 w-6 text-purple-600 mr-3" />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Project Preferences & Settings
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
                  Project-Specific Preferences
                </h2>
                <p className="text-sm text-gray-600">
                  These preferences override global settings and apply only to this project
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Preference
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading preferences...</p>
              </div>
            ) : (
              <>
                {/* Add New Preference Form */}
                {showAddForm && (
                  <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h3 className="font-medium text-gray-900 mb-4">Add New Preference</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source Name
                        </label>
                        <input
                          type="text"
                          value={newPreference.source}
                          onChange={(e) => setNewPreference({ ...newPreference, source: e.target.value })}
                          placeholder="e.g., project-editor-settings, team-workflow-preferences"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preference Content (Markdown)
                        </label>
                        <textarea
                          value={newPreference.content}
                          onChange={(e) => setNewPreference({ ...newPreference, content: e.target.value })}
                          rows={8}
                          placeholder="# Project Editor Preferences&#10;&#10;- Tab size: 2 spaces&#10;- Max line length: 120 characters&#10;- Auto-format on save&#10;- Use single quotes for strings"
                          className="input"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(newPreference.source, newPreference.content)}
                          disabled={!newPreference.source || !newPreference.content}
                          className="btn btn-primary"
                        >
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

                {/* Preferences List */}
                {preferences.length === 0 ? (
                  <div className="text-center py-12">
                    <CogIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Project Preferences</h3>
                    <p className="text-gray-500 mb-4">
                      This project is using global preferences only. Add project-specific preferences to customize them.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {preferences.map((preference) => (
                      <div key={preference.id} className="border border-gray-200 rounded-lg">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {preference.payload.source}
                              </h4>
                              <p className="text-sm text-gray-500">
                                Project Preference
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingPreference(preference)}
                                className="p-2 text-gray-400 hover:text-purple-600"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(preference.payload.source)}
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
                              {preference.payload.content}
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

      {/* Edit Preference Modal */}
      {editingPreference && (
        <Dialog open={true} onClose={() => setEditingPreference(null)} className="relative z-60">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
              <div className="p-6">
                <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                  Edit Preference: {editingPreference.payload.source}
                </Dialog.Title>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preference Content (Markdown)
                    </label>
                    <textarea
                      value={editingPreference.payload.content}
                      onChange={(e) =>
                        setEditingPreference({
                          ...editingPreference,
                          payload: { ...editingPreference.payload, content: e.target.value },
                        })
                      }
                      rows={12}
                      className="input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleSave(editingPreference.payload.source, editingPreference.payload.content, true)
                      }
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
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}