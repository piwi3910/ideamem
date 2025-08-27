'use client';

import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectFormSchema, type ProjectFormData } from '@/lib/schemas/forms';
import { Form, InputField, TextareaField, FormButtons } from '@/components/forms/Form';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateProjectModalProps) {
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      gitRepo: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      // Error is handled by the parent component
      console.error('Failed to create project:', error);
    }
  });

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              Add New Project
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <Form
            schema={projectFormSchema}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {() => (
              <>
                <InputField
                  form={form}
                  name="name"
                  label="Project Name"
                  placeholder="My Awesome Project"
                  required
                />

                <TextareaField
                  form={form}
                  name="description"
                  label="Description"
                  placeholder="Optional project description..."
                  rows={3}
                />

                <InputField
                  form={form}
                  name="gitRepo"
                  label="Git Repository URL"
                  type="url"
                  placeholder="https://github.com/user/repo.git"
                  required
                  helperText="GitHub, GitLab, or Bitbucket repository URL"
                />

                {form.formState.errors.root && (
                  <p className="text-red-600 text-sm">
                    {form.formState.errors.root.message}
                  </p>
                )}

                <FormButtons
                  form={form}
                  submitLabel="Create Project"
                  cancelLabel="Cancel"
                  onCancel={onClose}
                  isSubmitting={isSubmitting}
                  className="mt-6"
                />
              </>
            )}
          </Form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}