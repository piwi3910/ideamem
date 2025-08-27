/**
 * Client-side form validation schemas using Zod
 * These schemas are used with react-hook-form for form validation
 */

import { z } from 'zod';

// ============================================
// Constraints Form Schemas
// ============================================

export const constraintFormSchema = z.object({
  source: z.string()
    .min(1, 'Source is required')
    .max(100, 'Source must be less than 100 characters'),
  content: z.string()
    .min(1, 'Content is required')
    .max(5000, 'Content must be less than 5000 characters'),
  category: z.enum(['rule', 'tooling', 'workflow', 'formatting'])
    .describe('Please select a category'),
  scope: z.enum(['global', 'project'])
    .default('global')
    .describe('Please select a scope'),
  projectId: z.string().optional(),
});

export type ConstraintFormData = z.infer<typeof constraintFormSchema>;

// ============================================
// Projects Form Schemas
// ============================================

export const projectFormSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(50, 'Project name must be less than 50 characters')
    .trim()
    .regex(/^[a-zA-Z0-9-_\s]+$/, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  gitRepo: z.string()
    .min(1, 'Git repository URL is required')
    .url('Please enter a valid URL')
    .regex(/^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/.*/, 
      'Please enter a valid GitHub, GitLab, or Bitbucket repository URL')
    .trim(),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export const projectUpdateFormSchema = projectFormSchema.partial();
export type ProjectUpdateFormData = z.infer<typeof projectUpdateFormSchema>;

// ============================================
// Documentation Repository Form Schemas
// ============================================

export const docRepositoryFormSchema = z.object({
  name: z.string()
    .min(1, 'Repository name is required')
    .max(100, 'Repository name must be less than 100 characters')
    .trim(),
  url: z.string()
    .min(1, 'URL is required')
    .url('Please enter a valid URL')
    .trim(),
  sourceType: z.enum(['git', 'llmstxt', 'website'])
    .default('git')
    .describe('Please select a source type'),
  branch: z.string()
    .min(1, 'Branch name is required')
    .default('main')
    .trim(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  reindexInterval: z.coerce.number()
    .min(1, 'Reindex interval must be at least 1 day')
    .max(365, 'Reindex interval cannot exceed 365 days')
    .default(14),
  autoReindexEnabled: z.boolean().default(true),
});

export type DocRepositoryFormData = z.infer<typeof docRepositoryFormSchema>;

export const docRepositoryUpdateFormSchema = docRepositoryFormSchema.partial();
export type DocRepositoryUpdateFormData = z.infer<typeof docRepositoryUpdateFormSchema>;

// ============================================
// Schedule Configuration Form Schemas
// ============================================

export const scheduleConfigFormSchema = z.object({
  enabled: z.boolean().default(false),
  intervalMinutes: z.coerce.number()
    .min(5, 'Interval must be at least 5 minutes')
    .max(10080, 'Interval cannot exceed 7 days (10080 minutes)')
    .default(60),
  branch: z.string()
    .min(1, 'Branch name is required')
    .default('main')
    .trim(),
});

export type ScheduleConfigFormData = z.infer<typeof scheduleConfigFormSchema>;

// ============================================
// Webhook Configuration Form Schemas
// ============================================

export const webhookConfigFormSchema = z.object({
  enabled: z.boolean().default(false),
  secret: z.string()
    .min(10, 'Webhook secret must be at least 10 characters')
    .max(100, 'Webhook secret must be less than 100 characters')
    .optional(),
});

export type WebhookConfigFormData = z.infer<typeof webhookConfigFormSchema>;

// ============================================
// Search Form Schemas
// ============================================

export const searchFormSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be less than 200 characters')
    .trim(),
  type: z.enum(['code', 'documentation', 'conversation', 'user_preference', 'rule'])
    .optional(),
  language: z.string()
    .max(50, 'Language must be less than 50 characters')
    .optional(),
  source: z.string()
    .max(200, 'Source must be less than 200 characters')
    .optional(),
  projectId: z.string().optional(),
  limit: z.coerce.number()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10),
});

export type SearchFormData = z.infer<typeof searchFormSchema>;

// ============================================
// Configuration Form Schemas
// ============================================

export const appConfigFormSchema = z.object({
  qdrantUrl: z.string()
    .min(1, 'Qdrant URL is required')
    .url('Please enter a valid URL')
    .trim(),
  ollamaUrl: z.string()
    .min(1, 'Ollama URL is required')
    .url('Please enter a valid URL')
    .trim(),
  logLevel: z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly'])
    .default('info')
    .describe('Please select a log level'),
  docReindexEnabled: z.boolean().default(true),
  docReindexInterval: z.coerce.number()
    .min(1, 'Reindex interval must be at least 1 day')
    .max(365, 'Reindex interval cannot exceed 365 days')
    .default(14),
});

export type AppConfigFormData = z.infer<typeof appConfigFormSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Helper to get form validation errors in a user-friendly format
 */
export function getFormErrors<T>(result: ReturnType<z.ZodSchema<T>['safeParse']>): Record<string, string> {
  if (result.success) return {};
  
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });
  return errors;
}

/**
 * Helper to validate a single field
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  fieldName: keyof T,
  value: any
): string | undefined {
  try {
    const fieldSchema = (schema as any).shape[fieldName];
    if (fieldSchema) {
      fieldSchema.parse(value);
    }
    return undefined;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues[0]?.message;
    }
    return 'Invalid value';
  }
}

/**
 * Helper to create default form values from schema
 */
export function getDefaultValues<T extends z.ZodTypeAny>(
  schema: T
): z.infer<T> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const defaults: any = {};
    
    for (const key in shape) {
      const fieldSchema = shape[key];
      if (fieldSchema instanceof z.ZodDefault) {
        defaults[key] = fieldSchema._def.defaultValue();
      } else if (fieldSchema instanceof z.ZodOptional) {
        defaults[key] = undefined;
      } else if (fieldSchema instanceof z.ZodEnum) {
        defaults[key] = fieldSchema.options[0];
      } else if (fieldSchema instanceof z.ZodString) {
        defaults[key] = '';
      } else if (fieldSchema instanceof z.ZodNumber) {
        defaults[key] = 0;
      } else if (fieldSchema instanceof z.ZodBoolean) {
        defaults[key] = false;
      }
    }
    
    return defaults as z.infer<T>;
  }
  
  return {} as z.infer<T>;
}

// ============================================
// Export all schemas as namespace
// ============================================

export const FormSchemas = {
  constraint: constraintFormSchema,
  project: {
    create: projectFormSchema,
    update: projectUpdateFormSchema,
  },
  documentation: {
    create: docRepositoryFormSchema,
    update: docRepositoryUpdateFormSchema,
  },
  schedule: scheduleConfigFormSchema,
  webhook: webhookConfigFormSchema,
  search: searchFormSchema,
  appConfig: appConfigFormSchema,
  
  // Helpers
  helpers: {
    getFormErrors,
    validateField,
    getDefaultValues,
  },
};