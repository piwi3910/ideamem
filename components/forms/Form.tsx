'use client';

import React from 'react';
import {
  useForm,
  UseFormProps,
  FieldValues,
  SubmitHandler,
  UseFormReturn,
  FieldPath,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

export interface FormProps<TFieldValues extends FieldValues = FieldValues> {
  schema?: z.ZodSchema<TFieldValues>;
  defaultValues?: UseFormProps<TFieldValues>['defaultValues'];
  onSubmit: SubmitHandler<TFieldValues>;
  children:
    | React.ReactNode
    | ((form: UseFormReturn<TFieldValues>) => React.ReactNode);
  className?: string;
  id?: string;
}

/**
 * Reusable form component with Zod validation
 */
export function Form<TFieldValues extends FieldValues = FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
}: FormProps<TFieldValues>) {
  const form = useForm<TFieldValues>({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
  });

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <form id={id} onSubmit={handleSubmit} className={className}>
      {typeof children === 'function' ? children(form) : children}
    </form>
  );
}

interface InputFieldProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel';
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  helperText?: string;
}

/**
 * Form input field with error handling
 */
export function InputField<TFieldValues extends FieldValues = FieldValues>({
  form,
  name,
  label,
  placeholder,
  type = 'text',
  required,
  disabled,
  autoComplete,
  className = '',
  helperText,
}: InputFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <div className="space-y-1">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        {...register(name)}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`input ${error ? 'border-red-300' : ''} ${className}`}
      />
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          {error.message || 'This field is invalid'}
        </p>
      )}
    </div>
  );
}

interface TextareaFieldProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  helperText?: string;
}

/**
 * Form textarea field with error handling
 */
export function TextareaField<TFieldValues extends FieldValues = FieldValues>({
  form,
  name,
  label,
  placeholder,
  required,
  disabled,
  rows = 3,
  className = '',
  helperText,
}: TextareaFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <div className="space-y-1">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        {...register(name)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`input ${error ? 'border-red-300' : ''} ${className}`}
      />
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          {error.message || 'This field is invalid'}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helperText?: string;
}

/**
 * Form select field with error handling
 */
export function SelectField<TFieldValues extends FieldValues = FieldValues>({
  form,
  name,
  label,
  options,
  placeholder,
  required,
  disabled,
  className = '',
  helperText,
}: SelectFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <div className="space-y-1">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        {...register(name)}
        disabled={disabled}
        className={`input ${error ? 'border-red-300' : ''} ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600">
          {error.message || 'Please select an option'}
        </p>
      )}
    </div>
  );
}

interface CheckboxFieldProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  disabled?: boolean;
  className?: string;
  helperText?: string;
}

/**
 * Form checkbox field with error handling
 */
export function CheckboxField<TFieldValues extends FieldValues = FieldValues>({
  form,
  name,
  label,
  disabled,
  className = '',
  helperText,
}: CheckboxFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = form;

  const error = errors[name];

  return (
    <div className="space-y-1">
      <label className={`flex items-center space-x-2 ${className}`}>
        <input
          {...register(name)}
          type="checkbox"
          disabled={disabled}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">{label}</span>
      </label>
      {helperText && !error && (
        <p className="text-xs text-gray-500 ml-6">{helperText}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 ml-6">
          {error.message || 'This field is invalid'}
        </p>
      )}
    </div>
  );
}

interface FormButtonsProps {
  form: UseFormReturn<any>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  className?: string;
}

/**
 * Standard form buttons (submit and cancel)
 */
export function FormButtons({
  form,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onCancel,
  isSubmitting,
  submitDisabled,
  className = '',
}: FormButtonsProps) {
  const {
    formState: { isSubmitting: formIsSubmitting },
  } = form;

  const submitting = isSubmitting ?? formIsSubmitting;

  return (
    <div className={`flex justify-end gap-3 ${className}`}>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={submitting}
        >
          {cancelLabel}
        </button>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitDisabled || submitting}
      >
        {submitting ? (
          <span className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Processing...
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}

/**
 * Error summary component for displaying form-level errors
 */
interface ErrorSummaryProps {
  error?: string;
  errors?: Record<string, string>;
  className?: string;
}

export function ErrorSummary({ error, errors, className = '' }: ErrorSummaryProps) {
  if (!error && (!errors || Object.keys(errors).length === 0)) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-medium text-red-800 mb-2">
        Please fix the following errors:
      </h4>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {errors && (
        <ul className="list-disc list-inside space-y-1">
          {Object.entries(errors).map(([field, message]) => (
            <li key={field} className="text-sm text-red-700">
              <strong>{field}:</strong> {message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Success message component
 */
interface SuccessMessageProps {
  message?: string;
  className?: string;
}

export function SuccessMessage({ message, className = '' }: SuccessMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <p className="text-sm text-green-700">{message}</p>
    </div>
  );
}