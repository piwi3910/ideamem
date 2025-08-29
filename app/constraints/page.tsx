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
  ShieldCheckIcon,
  CogIcon,
  UserIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

// Import React Query hooks
import { useGlobalConstraints, useCreateGlobalConstraint, useUpdateGlobalConstraint, useDeleteGlobalConstraint, type Constraint } from '@/hooks/use-constraints';

// Import form schema
import { constraintFormSchema, type ConstraintFormData } from '@/lib/schemas/forms';

const CATEGORY_OPTIONS = [
  { value: 'rule', label: 'Rule', icon: ShieldCheckIcon, color: 'green' },
  { value: 'tooling', label: 'Tooling', icon: CogIcon, color: 'purple' },
  { value: 'workflow', label: 'Workflow', icon: UserIcon, color: 'blue' },
  { value: 'formatting', label: 'Formatting', icon: DocumentTextIcon, color: 'orange' },
] as const;

export default function ConstraintsPage() {
  // React Query hooks
  const { data: constraintsData, isLoading: loading, error: fetchError } = useGlobalConstraints();
  const constraints = constraintsData?.constraints || [];
  const createConstraintMutation = useCreateGlobalConstraint();
  const updateConstraintMutation = useUpdateGlobalConstraint();
  const deleteConstraintMutation = useDeleteGlobalConstraint();
  
  // Local UI state
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // React Hook Form for add form
  const addForm = useForm<ConstraintFormData>({
    resolver: zodResolver(constraintFormSchema) as any,
    defaultValues: {
      source: '',
      content: '',
      category: 'rule',
      scope: 'global',
    },
  });

  // React Hook Form for edit form
  const editForm = useForm<ConstraintFormData>({
    resolver: zodResolver(constraintFormSchema) as any,
  });
  
  const error = fetchError?.message || createConstraintMutation.error?.message || 
                updateConstraintMutation.error?.message || deleteConstraintMutation.error?.message || '';
  
  const saveMessage = createConstraintMutation.isSuccess ? 'Constraint added successfully' :
                     updateConstraintMutation.isSuccess ? 'Constraint updated successfully' :
                     deleteConstraintMutation.isSuccess ? 'Constraint deleted successfully' : '';

  const handleAddConstraint = async (data: ConstraintFormData) => {
    createConstraintMutation.mutate({
      source: data.source,
      content: data.content,
      category: data.category,
    }, {
      onSuccess: () => {
        addForm.reset();
        setShowAddForm(false);
      }
    });
  };

  const startEditConstraint = (constraint: Constraint) => {
    setEditingConstraint(constraint);
    editForm.reset({
      source: constraint.payload.source,
      content: constraint.payload.content,
      category: constraint.payload.category as any,
      scope: 'global',
    });
  };

  const handleEditConstraint = async (data: ConstraintFormData) => {
    if (!editingConstraint) return;

    updateConstraintMutation.mutate({
      id: editingConstraint.id,
      source: data.source,
      content: data.content,
      category: data.category,
    }, {
      onSuccess: () => {
        setEditingConstraint(null);
        editForm.reset();
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

  const filteredConstraints = selectedCategory === 'all' 
    ? constraints 
    : constraints.filter(c => c.payload.category === selectedCategory);

  const categoryCounts = constraintsData?.category_counts || {
    rule: 0,
    tooling: 0,
    workflow: 0,
    formatting: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <GlobeAltIcon className="w-6 h-6 mr-2 text-indigo-500" />
                  Global Constraints
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Define rules and preferences that apply to all projects
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  addForm.reset();
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center"
                disabled={createConstraintMutation.isPending}
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Constraint
              </button>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex space-x-4">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({constraints.length})
              </button>
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                    selectedCategory === cat.value
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <cat.icon className="w-4 h-4 mr-1" />
                  {cat.label} ({categoryCounts[cat.value as keyof typeof categoryCounts] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 rounded-lg flex items-start">
              <ExclamationCircleIcon className="w-5 h-5 text-red-400 mt-0.5" />
              <span className="ml-2 text-sm text-red-700">{error}</span>
            </div>
          )}

          {saveMessage && (
            <div className="mx-6 mt-4 p-4 bg-green-50 rounded-lg flex items-start">
              <CheckCircleIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <span className="ml-2 text-sm text-green-700">{saveMessage}</span>
            </div>
          )}

          {/* Add Constraint Form */}
          {showAddForm && (
            <form onSubmit={addForm.handleSubmit(handleAddConstraint)} className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source</label>
                  <input
                    {...addForm.register('source')}
                    type="text"
                    className={`mt-1 block w-full rounded-md shadow-sm ${
                      addForm.formState.errors.source
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g., typescript-standards, coding-guidelines"
                  />
                  {addForm.formState.errors.source && (
                    <p className="mt-1 text-sm text-red-600">{addForm.formState.errors.source.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <Controller
                    name="category"
                    control={addForm.control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className={`mt-1 block w-full rounded-md shadow-sm ${
                          addForm.formState.errors.category
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`}
                      >
                        {CATEGORY_OPTIONS.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                  {addForm.formState.errors.category && (
                    <p className="mt-1 text-sm text-red-600">{addForm.formState.errors.category.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <textarea
                    {...addForm.register('content')}
                    rows={4}
                    className={`mt-1 block w-full rounded-md shadow-sm ${
                      addForm.formState.errors.content
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="Enter your constraint content here..."
                  />
                  {addForm.formState.errors.content && (
                    <p className="mt-1 text-sm text-red-600">{addForm.formState.errors.content.message}</p>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      addForm.reset();
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    disabled={createConstraintMutation.isPending || !addForm.formState.isValid}
                  >
                    {createConstraintMutation.isPending ? 'Adding...' : 'Add Constraint'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Constraints List */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">Loading constraints...</p>
              </div>
            ) : filteredConstraints.length === 0 ? (
              <div className="text-center py-12">
                <TagIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  {selectedCategory === 'all' 
                    ? 'No constraints defined yet'
                    : `No ${selectedCategory} constraints`}
                </p>
                {selectedCategory === 'all' && (
                  <p className="mt-2 text-sm text-gray-400">
                    Click "Add Constraint" to define your first global constraint
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredConstraints.map((constraint) => {
                  const categoryConfig = getCategoryConfig(constraint.payload.category);
                  const isEditing = editingConstraint?.id === constraint.id;
                  
                  return (
                    <div
                      key={constraint.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {isEditing ? (
                        <form onSubmit={editForm.handleSubmit(handleEditConstraint)} className="space-y-4">
                          <div>
                            <input
                              {...editForm.register('source')}
                              type="text"
                              className={`block w-full rounded-md shadow-sm ${
                                editForm.formState.errors.source
                                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                              }`}
                            />
                            {editForm.formState.errors.source && (
                              <p className="mt-1 text-sm text-red-600">{editForm.formState.errors.source.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <Controller
                              name="category"
                              control={editForm.control}
                              render={({ field }) => (
                                <select
                                  {...field}
                                  className={`block w-full rounded-md shadow-sm ${
                                    editForm.formState.errors.category
                                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                                  }`}
                                >
                                  {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat.value} value={cat.value}>
                                      {cat.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                            {editForm.formState.errors.category && (
                              <p className="mt-1 text-sm text-red-600">{editForm.formState.errors.category.message}</p>
                            )}
                          </div>
                          
                          <div>
                            <textarea
                              {...editForm.register('content')}
                              rows={4}
                              className={`block w-full rounded-md shadow-sm ${
                                editForm.formState.errors.content
                                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                              }`}
                            />
                            {editForm.formState.errors.content && (
                              <p className="mt-1 text-sm text-red-600">{editForm.formState.errors.content.message}</p>
                            )}
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingConstraint(null);
                                editForm.reset();
                              }}
                              className="px-3 py-1 text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                              disabled={updateConstraintMutation.isPending || !editForm.formState.isValid}
                            >
                              {updateConstraintMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center">
                              <categoryConfig.icon className={`w-5 h-5 mr-2 text-${categoryConfig.color}-500`} />
                              <h3 className="font-medium text-gray-900">
                                {constraint.payload.source}
                              </h3>
                              <span className={`ml-3 px-2 py-1 text-xs rounded-full bg-${categoryConfig.color}-100 text-${categoryConfig.color}-800`}>
                                {categoryConfig.label}
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditConstraint(constraint)}
                                className="text-gray-400 hover:text-indigo-600"
                                disabled={updateConstraintMutation.isPending}
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteConstraint(constraint)}
                                className="text-gray-400 hover:text-red-600"
                                disabled={deleteConstraintMutation.isPending}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap">
                            {constraint.payload.content}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}