'use client';

import { Dialog } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName?: string;
  isDeleting?: boolean;
}

export default function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isDeleting,
}: DeleteProjectModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-red-600 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Delete Project
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isDeleting}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-700">
              Are you sure you want to delete{' '}
              {projectName && <strong>{projectName}</strong>}? This action cannot be
              undone and will:
            </p>
            <ul className="mt-3 ml-5 list-disc text-sm text-gray-600 space-y-1">
              <li>Remove all indexed data and vectors</li>
              <li>Delete all project preferences and constraints</li>
              <li>Cancel any pending indexing jobs</li>
              <li>Remove webhook and schedule configurations</li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> This action is permanent and cannot be reversed.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="btn bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deleting...
                </span>
              ) : (
                'Delete Project'
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}