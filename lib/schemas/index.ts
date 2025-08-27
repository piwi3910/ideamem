/**
 * Centralized Zod validation schemas for the entire application
 * This file exports all reusable schemas for API validation
 */

import { z } from 'zod';

// ============================================
// Common Base Schemas
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const projectIdSchema = z.string().min(1, 'Project ID is required');

export const sourceSchema = z.string().min(1, 'Source is required');

export const contentSchema = z.string().min(1, 'Content is required');

export const urlSchema = z.string().url('Invalid URL format');

export const emailSchema = z.string().email('Invalid email format');

// ============================================
// Enum Schemas
// ============================================

export const constraintCategoryEnum = z.enum(['rule', 'tooling', 'workflow', 'formatting']);

export const contentTypeEnum = z.enum([
  'code',
  'documentation',
  'conversation',
  'user_preference',
  'rule'
]);

export const searchTypeEnum = z.enum(['hybrid', 'semantic', 'keyword']);

export const logLevelEnum = z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly']);

export const indexStatusEnum = z.enum(['IDLE', 'INDEXING', 'COMPLETED', 'ERROR']);

export const triggerTypeEnum = z.enum(['MANUAL', 'WEBHOOK', 'SCHEDULED', 'API']);

// ============================================
// Pagination & Query Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  offset: z.coerce.number().min(0).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  type: contentTypeEnum.optional(),
  language: z.string().optional(),
  source: z.string().optional(),
});

// ============================================
// Project Schemas
// ============================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  description: z.string().trim().optional(),
  gitRepo: z.string().min(1, 'Git repository is required').trim(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().trim().optional(),
  gitRepo: z.string().trim().optional(),
  indexStatus: indexStatusEnum.optional(),
  webhookEnabled: z.boolean().optional(),
  scheduledIndexingEnabled: z.boolean().optional(),
  scheduledIndexingInterval: z.number().min(5).max(10080).optional(),
  scheduledIndexingBranch: z.string().optional(),
});

// ============================================
// Constraint/Preference Schemas
// ============================================

export const constraintSchema = z.object({
  source: sourceSchema,
  content: contentSchema,
  category: constraintCategoryEnum,
});

export const updateConstraintSchema = z.object({
  source: sourceSchema,
  content: contentSchema,
  category: constraintCategoryEnum.optional(),
});

// ============================================
// Configuration Schemas
// ============================================

export const appConfigSchema = z.object({
  qdrantUrl: z.string().url('Invalid URL format'),
  ollamaUrl: z.string().url('Invalid URL format'),
  logLevel: logLevelEnum,
  docReindexEnabled: z.boolean(),
  docReindexInterval: z.number().min(1, 'Reindex interval must be at least 1 day'),
});

export const healthCheckSchema = z.object({
  service: z.enum(['qdrant', 'ollama', 'ollama-embedding']).optional(),
});

// ============================================
// Indexing & Job Schemas
// ============================================

export const indexingJobSchema = z.object({
  projectId: projectIdSchema,
  jobId: z.string().optional(),
  branch: z.string().optional().default('main'),
  fullReindex: z.boolean().optional().default(false),
  triggeredBy: triggerTypeEnum.optional().default('MANUAL'),
});

export const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number()
    .min(5, 'Interval must be at least 5 minutes')
    .max(10080, 'Interval cannot exceed 7 days (10080 minutes)')
    .optional(),
  branch: z.string().optional(),
});

// ============================================
// Webhook Schemas
// ============================================

export const webhookToggleSchema = z.object({
  enabled: z.boolean(),
});

export const githubWebhookSchema = z.object({
  deleted: z.boolean().optional(),
  commits: z.array(z.any()).optional(),
  head_commit: z.object({
    id: z.string(),
    author: z.object({
      name: z.string(),
    }).optional(),
  }).optional(),
  ref: z.string().optional(),
  repository: z.any().optional(),
});

export const gitlabWebhookSchema = z.object({
  commits: z.array(z.any()).optional(),
  checkout_sha: z.string().optional(),
  ref: z.string().optional(),
  repository: z.any().optional(),
});

export const bitbucketWebhookSchema = z.object({
  push: z.object({
    changes: z.array(z.object({
      new: z.object({
        type: z.string().optional(),
        target: z.object({
          hash: z.string().optional(),
          author: z.object({
            raw: z.string().optional(),
          }).optional(),
        }).optional(),
        name: z.string().optional(),
      }).optional(),
    })).optional(),
  }).optional(),
  repo: z.any().optional(),
});

// ============================================
// Search & Visualization Schemas
// ============================================

export const facetSearchSchema = z.object({
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional().default({}),
  projectId: z.string().optional(),
});

export const visualizationSchema = z.object({
  results: z.array(z.any()),
  query: z.string().min(1, 'Query is required'),
  searchType: searchTypeEnum.optional().default('hybrid'),
  settings: z.any().optional(),
});

// ============================================
// Documentation Repository Schemas
// ============================================

export const createDocRepositorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL format'),
  sourceType: z.enum(['git', 'llmstxt', 'website']).optional(),
  branch: z.string().optional(),
  description: z.string().optional(),
  reindexInterval: z.number().min(1, 'Reindex interval must be at least 1 day').optional(),
  autoReindexEnabled: z.boolean().optional(),
});

export const updateDocRepositorySchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url('Invalid URL format').optional(),
  sourceType: z.enum(['git', 'llmstxt', 'website']).optional(),
  branch: z.string().optional(),
  description: z.string().optional(),
  reindexInterval: z.number().min(1).optional(),
  autoReindexEnabled: z.boolean().optional(),
});

// ============================================
// Queue Management Schemas
// ============================================

export const queueActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pause'),
    queueName: z.string().min(1, 'Queue name required'),
  }),
  z.object({
    action: z.literal('resume'),
    queueName: z.string().min(1, 'Queue name required'),
  }),
  z.object({
    action: z.literal('clean'),
    queueName: z.string().min(1, 'Queue name required'),
    data: z.object({
      grace: z.number().optional(),
    }).optional(),
  }),
  z.object({
    action: z.literal('addJob'),
    data: z.object({
      type: z.literal('indexing'),
      projectId: z.string().min(1, 'Project ID required'),
      jobId: z.string().optional(),
      branch: z.string().optional(),
      fullReindex: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal('cancelJob'),
    queueName: z.string().min(1, 'Queue name required'),
    data: z.object({
      jobId: z.string().min(1, 'Job ID required'),
    }),
  }),
]);

export const deleteQueueSchema = z.object({
  queueName: z.string().min(1, 'Queue name required'),
  confirm: z.literal('DELETE_ALL_JOBS'),
});

// ============================================
// Worker Management Schemas
// ============================================

export const workerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'restart']),
});

// ============================================
// Memory/Vector Store Schemas
// ============================================

export const memoryIngestionSchema = z.object({
  content: contentSchema,
  source: sourceSchema,
  type: contentTypeEnum,
  language: z.string().min(1, 'Language is required'),
  projectId: z.string().optional(),
});

export const memorySearchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().min(1).max(50).optional().default(5),
  filters: z.object({
    type: contentTypeEnum.optional(),
    language: z.string().optional(),
    source: z.string().optional(),
    projectId: z.string().optional(),
  }).optional(),
});

// ============================================
// Common Route Parameter Schemas
// ============================================

export const idParamSchema = z.object({
  id: z.string(),
});

export const projectIdParamSchema = z.object({
  projectId: z.string(),
});

// ============================================
// Response Schemas (for type safety)
// ============================================

export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional(),
});

export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
  code: z.string().optional(),
});

// ============================================
// Utility Functions
// ============================================

/**
 * Create a validated route handler with automatic error handling
 */
export function createValidatedHandler<T extends z.ZodSchema>(
  schema: T,
  handler: (data: z.infer<T>) => Promise<any>
) {
  return async (data: unknown) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }
    return handler(result.data);
  };
}

/**
 * Merge multiple schemas with proper type inference
 */
export function mergeSchemas<T extends z.ZodRawShape, U extends z.ZodRawShape>(
  schema1: z.ZodObject<T>,
  schema2: z.ZodObject<U>
) {
  return schema1.merge(schema2);
}

// Export all schemas as a namespace for easy importing
export const Schemas = {
  // Base
  uuid: uuidSchema,
  projectId: projectIdSchema,
  source: sourceSchema,
  content: contentSchema,
  url: urlSchema,
  email: emailSchema,
  
  // Enums
  constraintCategory: constraintCategoryEnum,
  contentType: contentTypeEnum,
  searchType: searchTypeEnum,
  logLevel: logLevelEnum,
  indexStatus: indexStatusEnum,
  triggerType: triggerTypeEnum,
  
  // Common patterns
  pagination: paginationSchema,
  searchQuery: searchQuerySchema,
  
  // Domain specific
  project: {
    create: createProjectSchema,
    update: updateProjectSchema,
  },
  constraint: {
    create: constraintSchema,
    update: updateConstraintSchema,
  },
  config: appConfigSchema,
  healthCheck: healthCheckSchema,
  indexing: indexingJobSchema,
  schedule: scheduleConfigSchema,
  webhook: {
    toggle: webhookToggleSchema,
    github: githubWebhookSchema,
    gitlab: gitlabWebhookSchema,
    bitbucket: bitbucketWebhookSchema,
  },
  search: {
    facet: facetSearchSchema,
    visualization: visualizationSchema,
  },
  documentation: {
    create: createDocRepositorySchema,
    update: updateDocRepositorySchema,
  },
  queue: {
    action: queueActionSchema,
    delete: deleteQueueSchema,
  },
  worker: workerActionSchema,
  memory: {
    ingestion: memoryIngestionSchema,
    search: memorySearchSchema,
  },
  params: {
    id: idParamSchema,
    projectId: projectIdParamSchema,
  },
  response: {
    success: successResponseSchema,
    error: errorResponseSchema,
  },
};