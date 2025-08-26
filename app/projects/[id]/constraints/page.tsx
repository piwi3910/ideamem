'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  CogIcon,
  UserIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

// Import React Query hooks
import { useProject } from '@/hooks/use-projects';
import { useProjectConstraints, useCreateProjectConstraint, useUpdateProjectConstraint, useDeleteProjectConstraint, type Constraint } from '@/hooks/use-constraints';

interface Project {
  id: string;
  name: string;
  description?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'rule', label: 'Rule', icon: ShieldCheckIcon, color: 'green' },
  { value: 'tooling', label: 'Tooling', icon: CogIcon, color: 'purple' },
  { value: 'workflow', label: 'Workflow', icon: UserIcon, color: 'blue' },
  { value: 'formatting', label: 'Formatting', icon: DocumentTextIcon, color: 'orange' },
];


export default function ProjectConstraintsPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  // React Query hooks
  const { data: project } = useProject(projectId);
  const { data: constraintsData, isLoading: loading, error: fetchError } = useProjectConstraints(projectId);
  const constraints = constraintsData?.constraints || [];
  const createConstraintMutation = useCreateProjectConstraint(projectId);
  const updateConstraintMutation = useUpdateProjectConstraint(projectId);
  const deleteConstraintMutation = useDeleteProjectConstraint(projectId);
  
  // Local UI state
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null);
  const [newConstraint, setNewConstraint] = useState<{
    source: string;
    content: string;
    category: 'rule' | 'tooling' | 'workflow' | 'formatting';
  }>({ 
    source: '', 
    content: '', 
    category: 'rule'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const error = fetchError?.message || createConstraintMutation.error?.message || 
                updateConstraintMutation.error?.message || deleteConstraintMutation.error?.message || '';
  
  const saveMessage = createConstraintMutation.isSuccess ? 'Constraint added successfully' :
                     updateConstraintMutation.isSuccess ? 'Constraint updated successfully' :
                     deleteConstraintMutation.isSuccess ? 'Constraint deleted successfully' : '';

  const handleAddConstraint = async () => {
    if (!newConstraint.source.trim() || !newConstraint.content.trim()) {
      return;
    }

    createConstraintMutation.mutate({
      source: newConstraint.source,
      content: newConstraint.content,
      category: newConstraint.category,
    }, {
      onSuccess: () => {
        setNewConstraint({ source: '', content: '', category: 'rule' });
        setShowAddForm(false);
      }
    });
  };

  const handleEditConstraint = async (constraint: Constraint) => {
    if (!editingConstraint) return;

    updateConstraintMutation.mutate({
      id: constraint.id,
      source: editingConstraint.payload.source,
      content: editingConstraint.payload.content,
      category: editingConstraint.payload.category,
    }, {
      onSuccess: () => {
        setEditingConstraint(null);
      }
    });
  };

  const handleDeleteConstraint = async (constraint: Constraint) => {
    if (!confirm(`Are you sure you want to delete the constraint from "${constraint.payload.source}"?`)) {
      return;
    }

    deleteConstraintMutation.mutate(constraint.payload.source);
  };

  const getCategoryConfig = (category: string) => {
    return CATEGORY_OPTIONS.find(opt => opt.value === category) || CATEGORY_OPTIONS[0];
  };

  const getFilteredConstraints = () => {
    let filtered = constraints;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.payload.category === selectedCategory);
    }

    return filtered;
  };

  const renderConstraintContent = (content: string) => {
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

  const filteredConstraints = getFilteredConstraints();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Constraints</h1>
          <p className="text-gray-600 mt-1">
            {project ? `Manage constraints for ${project.name}` : 'Loading project...'}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add Constraint
        </button>
      </div>
      
      {/* Introduction */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Project-Specific Constraints</h2>
            <p className="text-gray-600 mb-4">
              Manage coding rules and user preferences specific to this project. 
              These constraints override global settings and are used by the MCP validation tools.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Priority:</strong> These project-specific constraints take precedence over global constraints.
                They will be enforced by the MCP tools when working on this project.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filter by Category</h3>
        <div>
          <label className="label">Category</label>
          <select
            className="input w-48"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Constraints List Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Current Constraints ({filteredConstraints.length})
        </h3>
      </div>

      {/* Add Constraint Form */}
      {showAddForm && (
        <div className="card">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Constraint</h4>
          <div className="space-y-4">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={newConstraint.category}
                onChange={(e) => setNewConstraint({ ...newConstraint, category: e.target.value as 'rule' | 'tooling' | 'workflow' | 'formatting' })}
              >
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose the appropriate category for your constraint.
              </p>
            </div>
            <div>
              <label className="label">Source Identifier</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., project-typescript-rules, project-testing-preferences"
                value={newConstraint.source}
                onChange={(e) => setNewConstraint({ ...newConstraint, source: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier for this project constraint. Use kebab-case naming.
              </p>
            </div>
            <div>
              <label className="label">Content (Markdown)</label>
              <textarea
                className="input min-h-[200px] font-mono text-sm"
                placeholder={`# Constraint Title

## Section 1
- Item 1
- Item 2

## Section 2
- More items here`}
                value={newConstraint.content}
                onChange={(e) => setNewConstraint({ ...newConstraint, content: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Use markdown formatting. This content will be searchable by the MCP validation tools.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddConstraint} className="btn btn-primary">
                Save Constraint
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewConstraint({ source: '', content: '', category: 'rule' });
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

      {/* Constraints List */}
      {loading ? (
        <div className="card">
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-500">Loading constraints...</div>
          </div>
        </div>
      ) : filteredConstraints.length === 0 ? (
        <div className="card">
          <div className="text-center py-8">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Constraints Found</h3>
            <p className="text-gray-600 mb-4">Get started by adding your first project-specific constraint.</p>
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add First Constraint
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConstraints.map((constraint) => {
            const categoryConfig = getCategoryConfig(constraint.payload.category);
            const CategoryIcon = categoryConfig.icon;
            
            return (
              <div key={constraint.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-${categoryConfig.color}-100 rounded-lg`}>
                      <CategoryIcon className={`h-5 w-5 text-${categoryConfig.color}-600`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{constraint.payload.source}</h4>
                        <div className="flex items-center gap-1">
                          <TagIcon className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{categoryConfig.label}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        Project Preferences • {categoryConfig.label} Category
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingConstraint({ ...constraint })}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit constraint"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteConstraint(constraint)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete constraint"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {editingConstraint && editingConstraint.id === constraint.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Source Identifier</label>
                        <input
                          type="text"
                          className="input"
                          value={editingConstraint.payload.source}
                          onChange={(e) =>
                            setEditingConstraint({
                              ...editingConstraint,
                              payload: { ...editingConstraint.payload, source: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Category</label>
                        <select
                          className="input"
                          value={editingConstraint.payload.category}
                          onChange={(e) =>
                            setEditingConstraint({
                              ...editingConstraint,
                              payload: { ...editingConstraint.payload, category: e.target.value as 'rule' | 'tooling' | 'workflow' | 'formatting' },
                            })
                          }
                        >
                          {CATEGORY_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label">Content</label>
                      <textarea
                        className="input min-h-[200px] font-mono text-sm"
                        value={editingConstraint.payload.content}
                        onChange={(e) =>
                          setEditingConstraint({
                            ...editingConstraint,
                            payload: { ...editingConstraint.payload, content: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleEditConstraint(constraint)} className="btn btn-primary">
                        Save Changes
                      </button>
                      <button onClick={() => setEditingConstraint(null)} className="btn btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {renderConstraintContent(constraint.payload.content)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}