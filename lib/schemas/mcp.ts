/**
 * MCP (Model Context Protocol) Tool Schemas using Zod
 * These schemas validate tool arguments for the MCP API
 */

import { z } from 'zod';

// ============================================
// Codebase Management Tools
// ============================================

export const codebaseStoreSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .describe('The raw text or code content to be ingested'),
  source: z.string()
    .min(1, 'Source is required')
    .describe('Unique identifier for the content origin'),
  type: z.enum(['code', 'documentation', 'conversation'])
    .describe('Content category that affects processing'),
  language: z.string()
    .min(1, 'Language is required')
    .describe('Programming or markup language'),
});

export const codebaseSearchSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .describe('Natural language query'),
  filters: z.object({
    type: z.enum(['code', 'documentation', 'conversation']).optional(),
    language: z.string().optional(),
    source: z.string().optional(),
  }).optional().describe('Optional filters to narrow search'),
});

export const codebaseForgetSchema = z.object({
  source: z.string()
    .min(1, 'Source is required')
    .describe('Exact source identifier to delete'),
});

// ============================================
// Indexing Tools
// ============================================

export const codebaseIndexFileSchema = z.object({
  file_path: z.string()
    .min(1, 'File path is required')
    .describe('Relative path to the file'),
  branch: z.string()
    .optional()
    .default('main')
    .describe('Git branch to index from'),
});

export const codebaseRefreshFileSchema = z.object({
  file_path: z.string()
    .min(1, 'File path is required')
    .describe('Relative path to the file'),
  branch: z.string()
    .optional()
    .default('main')
    .describe('Git branch to reindex from'),
});

export const codebaseRebuildAllSchema = z.object({
  branch: z.string()
    .optional()
    .default('main')
    .describe('Git branch to reindex from'),
});

export const codebaseSyncChangesSchema = z.object({
  branch: z.string()
    .optional()
    .default('main')
    .describe('Git branch to check for changes'),
});

export const codebaseCleanupProjectSchema = z.object({});

// ============================================
// Constraints & Preferences Tools
// ============================================

export const codebaseCheckConstraintsSchema = z.object({
  coding_task: z.string()
    .optional()
    .describe('Brief description of coding task'),
});

export const codebaseSetConstraintsSchema = z.object({
  category: z.enum(['rule', 'tooling', 'workflow', 'formatting'])
    .describe('Category of constraint'),
  source: z.string()
    .min(1, 'Source is required')
    .describe('Unique identifier for the constraint'),
  content: z.string()
    .min(1, 'Content is required')
    .describe('Constraint content in markdown format'),
  scope: z.enum(['global', 'project'])
    .optional()
    .default('global')
    .describe('Scope of the constraint'),
});

// ============================================
// Code Validation Tools
// ============================================

export const codebaseValidateSymbolSchema = z.object({
  symbol_name: z.string()
    .min(1, 'Symbol name is required')
    .describe('The exact symbol name to validate'),
  context: z.string()
    .min(1, 'Context is required')
    .describe('Where you are trying to use this symbol'),
  expected_type: z.string()
    .optional()
    .describe('Expected type/category of the symbol'),
  file_context: z.string()
    .optional()
    .describe('File where the symbol is being used'),
});

export const codebaseCheckInterfaceChangesSchema = z.object({
  interface_name: z.string()
    .min(1, 'Interface name is required')
    .describe('Name of the interface/type/function being changed'),
  proposed_changes: z.string()
    .min(1, 'Proposed changes are required')
    .describe('Description of changes to make'),
  change_type: z.enum([
    'add_property',
    'remove_property',
    'rename_property',
    'change_type',
    'function_signature',
    'enum_values'
  ]).describe('Type of change being made'),
});

export const codebaseFindUsagePatternsSchema = z.object({
  symbol_name: z.string()
    .min(1, 'Symbol name is required')
    .describe('Symbol to find usages of'),
  usage_type: z.enum([
    'all',
    'function_calls',
    'property_access',
    'enum_values',
    'imports',
    'type_annotations'
  ])
    .optional()
    .default('all')
    .describe('Type of usage to find'),
  include_similar: z.boolean()
    .optional()
    .default(false)
    .describe('Include similar/related symbols'),
});

export const codebaseValidateEnumValuesSchema = z.object({
  enum_name: z.string()
    .min(1, 'Enum name is required')
    .describe('Name of the enum type'),
  value_being_used: z.string()
    .min(1, 'Value is required')
    .describe('The enum value being used'),
  usage_context: z.string()
    .min(1, 'Usage context is required')
    .describe('How the enum value is being used'),
});

export const codebaseCheckFunctionSignatureSchema = z.object({
  function_name: z.string()
    .min(1, 'Function name is required')
    .describe('Name of the function to validate'),
  parameters_attempting: z.array(z.object({
    name: z.string(),
    type: z.string(),
    value: z.string(),
  }))
    .min(0)
    .describe('Parameters being passed'),
  call_context: z.string()
    .min(1, 'Call context is required')
    .describe('Where the function is being called'),
});

// ============================================
// Documentation Tools
// ============================================

export const docsListRepositoriesSchema = z.object({});

export const docsAddRepositorySchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .min(1, 'URL is required')
    .describe('Documentation source URL'),
});

export const docsIndexRepositorySchema = z.object({
  repository_id: z.string()
    .min(1, 'Repository ID is required')
    .describe('ID of the repository to index'),
});

export const docsSearchSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .describe('Natural language search query'),
  limit: z.number()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Maximum results to return'),
  language_filter: z.string()
    .optional()
    .describe('Filter by programming language'),
  repository_filter: z.string()
    .optional()
    .describe('Filter to specific repository'),
});

export const docsHybridSearchSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .describe('Natural language search query'),
  search_type: z.enum(['semantic', 'keyword', 'hybrid'])
    .optional()
    .default('hybrid')
    .describe('Search method'),
  limit: z.number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum results'),
  filters: z.object({
    languages: z.array(z.string()).optional(),
    content_types: z.array(z.string()).optional(),
    complexity: z.array(z.string()).optional(),
    freshness: z.object({
      min: z.number().min(0).max(1).optional(),
      max: z.number().min(0).max(1).optional(),
    }).optional(),
  }).optional(),
});

export const docsSearchSuggestionsSchema = z.object({
  partial_query: z.string()
    .min(1, 'Partial query is required')
    .describe('Partial search query'),
  suggestion_type: z.enum(['completion', 'correction', 'expansion', 'related'])
    .describe('Type of suggestions'),
  limit: z.number()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Maximum suggestions'),
});

export const docsRelationshipGraphSchema = z.object({
  options: z.object({
    maxNodes: z.number()
      .min(1)
      .max(500)
      .optional()
      .default(200)
      .describe('Maximum nodes in graph'),
    minStrength: z.number()
      .min(0)
      .max(1)
      .optional()
      .default(0.3)
      .describe('Minimum relationship strength'),
    includeWeakRelationships: z.boolean()
      .optional()
      .default(false)
      .describe('Include weak relationships'),
  }).optional(),
});

export const docsFindRelatedSchema = z.object({
  document_id: z.string()
    .min(1, 'Document ID is required')
    .describe('ID of the document'),
  limit: z.number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum related documents'),
  min_strength: z.number()
    .min(0)
    .max(1)
    .optional()
    .default(0.3)
    .describe('Minimum relationship strength'),
});

export const docsFacetedSearchSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .describe('Natural language search query'),
  filters: z.object({
    languages: z.array(z.string()).optional(),
    contentTypes: z.array(z.string()).optional(),
    sourceTypes: z.array(z.string()).optional(),
    complexity: z.array(z.string()).optional(),
    hasExamples: z.boolean().optional(),
    freshnessRange: z.object({
      min: z.number().min(0).max(1).optional(),
      max: z.number().min(0).max(1).optional(),
    }).optional(),
    popularityRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).optional(),
});

// ============================================
// Tool Registry with Schemas
// ============================================

export const MCPToolSchemas = {
  // Codebase tools
  'codebase.store': codebaseStoreSchema,
  'codebase.search': codebaseSearchSchema,
  'codebase.forget': codebaseForgetSchema,
  'codebase.index_file': codebaseIndexFileSchema,
  'codebase.refresh_file': codebaseRefreshFileSchema,
  'codebase.rebuild_all': codebaseRebuildAllSchema,
  'codebase.sync_changes': codebaseSyncChangesSchema,
  'codebase.cleanup_project': codebaseCleanupProjectSchema,
  'codebase.check_constraints': codebaseCheckConstraintsSchema,
  'codebase.set_constraints': codebaseSetConstraintsSchema,
  'codebase.validate_symbol': codebaseValidateSymbolSchema,
  'codebase.check_interface_changes': codebaseCheckInterfaceChangesSchema,
  'codebase.find_usage_patterns': codebaseFindUsagePatternsSchema,
  'codebase.validate_enum_values': codebaseValidateEnumValuesSchema,
  'codebase.check_function_signature': codebaseCheckFunctionSignatureSchema,
  
  // Documentation tools
  'docs.list_repositories': docsListRepositoriesSchema,
  'docs.add_repository': docsAddRepositorySchema,
  'docs.index_repository': docsIndexRepositorySchema,
  'docs.search': docsSearchSchema,
  'docs.hybrid_search': docsHybridSearchSchema,
  'docs.search_suggestions': docsSearchSuggestionsSchema,
  'docs.relationship_graph': docsRelationshipGraphSchema,
  'docs.find_related': docsFindRelatedSchema,
  'docs.faceted_search': docsFacetedSearchSchema,
} as const;

// Type for all tool names
export type MCPToolName = keyof typeof MCPToolSchemas;

// Helper to validate tool arguments
export function validateToolArguments(toolName: MCPToolName, args: unknown) {
  const schema = MCPToolSchemas[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  return schema.parse(args);
}

// Helper to get tool schema for MCP protocol
export function getToolSchema(toolName: MCPToolName) {
  const schema = MCPToolSchemas[toolName];
  if (!schema) {
    return null;
  }
  
  // Convert Zod schema to JSON Schema format for MCP
  // This is a simplified conversion - in production you might use a library
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(schema.shape || {}).map(([key, value]) => {
        // Basic conversion - would need more work for complex schemas
        return [key, {
          type: 'string', // Simplified - would need proper type detection
          description: (value as any)._def?.description || '',
        }];
      })
    ),
    required: Object.keys(schema.shape || {}).filter(key => 
      !(schema.shape as any)[key].isOptional()
    ),
  };
}