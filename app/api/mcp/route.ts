import { NextRequest, NextResponse } from 'next/server';
import { ingest, retrieve, deleteSource } from '@/lib/memory';
import { trackQuery } from '@/lib/projects';
import { validateBearerToken } from '@/lib/auth';

interface SearchResult {
  payload?: {
    source: string;
    type: string;
    content: string;
    language?: string;
  };
  metadata?: {
    source: string;
    language?: string;
    type?: string;
  };
  content?: string;
  score: number;
  similarity?: number;
}
import {
  indexSingleFile,
  reindexSingleFile,
  fullReindex,
  scheduledIncrementalIndexing,
} from '@/lib/indexing';
import { deleteAllProjectVectors } from '@/lib/memory';
import { SearchResultsCache } from '@/lib/cache';
import { HybridSearchEngine } from '@/lib/hybrid-search';
import { QueryEnhancer } from '@/lib/query-enhancement';
import { MCPToolSchemas, validateToolArguments, type MCPToolName } from '@/lib/schemas/mcp';
import { z } from 'zod';
import { MiddlewareStacks } from '@/lib/middleware/compose';

// Define ToolSchema objects for our custom methods
const INGEST_TOOL_SCHEMA = {
  name: 'codebase.store',
  description:
    "🤖 AI ASSISTANT: Store code/docs for future semantic search. WHEN TO USE: After reading important files, discovering key implementations, or learning new patterns. Creates searchable knowledge base. 💡 TIP: Use this when you find solutions, patterns, or important code - makes future searches much more effective than re-reading files. ⚠️ NOTE: For rules and preferences, use 'codebase.set_constraints' instead.",
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description:
          'The raw text or code content to be ingested. Can be entire files, code snippets, documentation sections, or conversation transcripts. For code, functions and classes will be automatically extracted and chunked separately. Examples: source code files, README content, API documentation, chat conversations.',
      },
      source: {
        type: 'string',
        description:
          'Unique identifier for the content origin. Use consistent naming like file paths (src/components/Button.tsx), URLs (github.com/user/repo/README.md), or identifiers (conversation-2024-01-15). This is used for updates and deletions, so keep it stable and unique.',
      },
      type: {
        type: 'string',
        enum: ['code', 'documentation', 'conversation'],
        description:
          "Content category that affects processing: 'code' enables AST parsing for JS/TS with function/class extraction, 'documentation' for guides/specs/READMEs, 'conversation' for chat logs/discussions. NOTE: For rules and preferences, use 'codebase.set_constraints' instead.",
      },
      language: {
        type: 'string',
        description:
          "Programming language (typescript, javascript, python, rust, go, java, c, cpp, etc.) or markup language (markdown, html, json, yaml, xml, etc.). For code content, determines parsing strategy. Use 'text' for plain text content. Be specific for better chunking.",
      },
    },
    required: ['content', 'source', 'type', 'language'],
  },
};

const RETRIEVE_TOOL_SCHEMA = {
  name: 'codebase.search',
  description:
    "🔍 AI ASSISTANT: SEARCH FIRST before Read/Grep! Finds code by meaning, not just keywords. EXAMPLES: 'authentication patterns', 'error handling in APIs', 'React component lifecycle', 'database queries', 'webhook validation'. 🚀 MUCH FASTER than grep - understands context, finds similar implementations even with different names. 🎯 SMART WORKFLOW: Use 'codebase.check_constraints' first to understand rules and preferences, then search for existing code patterns.",
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          "Natural language query describing what you're looking for. Can be conceptual ('authentication logic', 'error handling patterns'), specific ('how to calculate cart total', 'user login function'), or technical ('React components that handle forms', 'API endpoints for user management'). More specific and detailed queries yield better results.",
      },
      filters: {
        type: 'object',
        description:
          'Optional key-value filters to narrow search scope. Common patterns: {"type": "code"} for code only, {"language": "typescript"} for specific language, {"source": "src/components/"} for source path matching. Multiple filters are AND-combined. Filter keys: \'type\', \'language\', \'source\'.',
        additionalProperties: true,
        properties: {
          type: {
            type: 'string',
            enum: ['code', 'documentation', 'conversation'],
            description: 'Filter by content type. NOTE: For rules and preferences, use codebase.check_constraints instead.',
          },
          language: { type: 'string', description: 'Filter by programming/markup language' },
          source: {
            type: 'string',
            description: 'Filter by source path/identifier (supports partial matching)',
          },
        },
      },
    },
    required: ['query'],
  },
};

const DELETE_SOURCE_TOOL_SCHEMA = {
  name: 'codebase.forget',
  description:
    '🗑️ AI ASSISTANT: Remove outdated/deleted code from search index. WHEN TO USE: After deleting files, major refactors, or when search returns obsolete results. Keeps search results clean and current. 💡 TIP: Use before re-indexing renamed or moved files.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description:
          "Exact source identifier to delete. Must match the 'source' field used during ingestion exactly (case-sensitive). Examples: 'src/components/Button.tsx', 'docs/api.md', 'conversation-2024-01-15'. Use memory.retrieve first to verify exact source names if unsure. Partial matches are not supported.",
      },
    },
    required: ['source'],
  },
};


const INDEX_FILE_TOOL_SCHEMA = {
  name: 'codebase.index_file',
  description:
    "⚡ AI ASSISTANT: Make specific file searchable NOW. WHEN TO USE: Just wrote important code, created key components, or added crucial docs. Makes it immediately findable for future searches. 🎯 PERFECT FOR: New implementations, important utilities, API endpoints you'll reference later.",
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description:
          "Relative path to the file within the repository (e.g., 'src/components/Button.tsx', 'README.md')",
      },
      branch: {
        type: 'string',
        description: "Git branch to index from (default: 'main')",
      },
    },
    required: ['file_path'],
  },
};

const REINDEX_FILE_TOOL_SCHEMA = {
  name: 'codebase.refresh_file',
  description:
    '🔄 AI ASSISTANT: Refresh outdated file in search index. WHEN TO USE: After major edits to important files, when search returns old versions, or after refactoring. Updates the searchable version to match current code. 💡 BETTER than full reindex - targets specific files.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description:
          "Relative path to the file within the repository (e.g., 'src/components/Button.tsx', 'README.md')",
      },
      branch: {
        type: 'string',
        description: "Git branch to reindex from (default: 'main')",
      },
    },
    required: ['file_path'],
  },
};

const FULL_REINDEX_TOOL_SCHEMA = {
  name: 'codebase.rebuild_all',
  description:
    '🔨 AI ASSISTANT: Rebuild entire project search index from scratch. WHEN TO USE: After major refactoring, when searches consistently return wrong results, or starting fresh. NUCLEAR OPTION - use sparingly. ⚠️ SLOW but thorough - rebuilds complete searchable knowledge base.',
  inputSchema: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: "Git branch to reindex from (default: 'main')",
      },
    },
    required: [],
  },
};

const SCHEDULED_INDEXING_TOOL_SCHEMA = {
  name: 'codebase.sync_changes',
  description:
    '🤖 AI ASSISTANT: Smart sync - only indexes NEW changes. WHEN TO USE: Want to ensure search is current, working on active codebase, or periodic maintenance. SUPER EFFICIENT - skips if no changes, only processes modified files. 🎯 PERFECT FOR: Development workflows.',
  inputSchema: {
    type: 'object',
    properties: {
      branch: {
        type: 'string',
        description: "Git branch to check for changes (default: 'main')",
      },
    },
    required: [],
  },
};

const CHECK_CONSTRAINTS_TOOL_SCHEMA = {
  name: 'codebase.check_constraints',
  description:
    '🚨 AI ASSISTANT: MANDATORY FIRST STEP before coding! Retrieves coding rules and preferences from database that must be followed. WHEN TO USE: Always run before writing any code to ensure compliance with coding standards, style guides, architecture constraints, and team preferences. PROJECT RULES OVERRIDE GLOBAL RULES. Use this, not codebase.search, for constraint checking.',
  inputSchema: {
    type: 'object',
    properties: {
      coding_task: {
        type: 'string',
        description:
          "Brief description of what you're about to code (e.g., 'React component', 'API endpoint', 'database schema'). Helps find relevant constraints.",
      },
    },
    required: [],
  },
};

const SET_CONSTRAINTS_TOOL_SCHEMA = {
  name: 'codebase.set_constraints',
  description:
    '📝 AI ASSISTANT: Store coding preferences in database with categorization. WHEN TO USE: When establishing coding standards, style guides, architecture constraints, security policies, or team preferences that future coding tasks must follow. All stored as preferences with categories (rule, tooling, workflow, formatting). Stored in database (not vectors).',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['rule', 'tooling', 'workflow', 'formatting'],
        description:
          "Category of constraint: 'rule' for coding rules and standards, 'tooling' for IDE and development tools, 'workflow' for development processes, 'formatting' for code style and formatting rules.",
      },
      source: {
        type: 'string',
        description:
          'Unique identifier for the constraint (e.g., "typescript-standards", "coding-guidelines", "team-preferences"). Used for updates and deletions.',
      },
      content: {
        type: 'string',
        description:
          'The constraint content in markdown format. Should be clear, specific, and actionable. Examples: coding style rules, architecture patterns, security requirements.',
      },
      scope: {
        type: 'string',
        enum: ['global', 'project'],
        description:
          'Scope of the constraint: "global" applies to all projects, "project" applies only to current project. Project-specific constraints override global ones.',
        default: 'global',
      },
    },
    required: ['category', 'source', 'content'],
  },
};

const CLEANUP_PROJECT_TOOL_SCHEMA = {
  name: 'codebase.cleanup_project',
  description:
    '🧹 AI ASSISTANT: Emergency cleanup - removes ALL indexed content for a project. WHEN TO USE: When search returns stale results after file deletions, before full reindex, or when project has orphaned vectors. ⚠️ DESTRUCTIVE: This permanently deletes all vectors for the project.',
  inputSchema: {
    type: 'object',
    properties: {
    },
    required: [],
  },
};

// Code Validation Tools - Prevent common migration and refactoring errors
const VALIDATE_SYMBOL_TOOL_SCHEMA = {
  name: 'codebase.validate_symbol',
  description:
    "🔍 AI ASSISTANT: CRITICAL VALIDATION TOOL - Use BEFORE referencing any variable, function, enum, type, or property. PREVENTS: 'updateIndexingProgress is not defined', 'project already declared', 'IndexStatus.COMPLETED vs indexing', property mismatches. WHEN TO USE: Before every function call, variable declaration, enum comparison, property access, import statement. ESSENTIAL during migrations, type changes, interface updates. ⚠️ MANDATORY: Always validate symbols before using them - saves hours of debugging build errors.",
  inputSchema: {
    type: 'object',
    properties: {
      symbol_name: {
        type: 'string',
        description:
          "The exact symbol name you want to validate (variable, function, enum value, property, etc.). Examples: 'updateIndexingProgress', 'IndexStatus.COMPLETED', 'project.fileCount', 'JobStatus'",
      },
      context: {
        type: 'string',
        description:
          "Where you're trying to use this symbol. Examples: 'function call in indexing.ts', 'enum comparison in React component', 'property access on Project type', 'import statement'",
      },
      expected_type: {
        type: 'string',
        description:
          "Optional: What type/category you expect this symbol to be. Examples: 'function', 'enum value', 'property', 'type', 'variable', 'constant'",
      },
      file_context: {
        type: 'string',
        description:
          "Optional: The file where you're trying to use this symbol. Helps provide more accurate validation.",
      },
    },
    required: ['symbol_name', 'context'],
  },
};

const CHECK_INTERFACE_CHANGES_TOOL_SCHEMA = {
  name: 'codebase.check_interface_changes',
  description:
    '🔄 AI ASSISTANT: MIGRATION SAFETY CHECKER - Use when changing interfaces, types, or function signatures. PREVENTS: breaking changes, missing properties, parameter mismatches. WHEN TO USE: Before modifying any interface, type definition, function signature, or enum. During migrations when updating from old patterns to new ones. ⚠️ ESSENTIAL: Use this before making any breaking changes to understand impact.',
  inputSchema: {
    type: 'object',
    properties: {
      interface_name: {
        type: 'string',
        description:
          "Name of the interface, type, or function being changed. Examples: 'Project', 'IndexingJob', 'updateIndexingProgress', 'CreateProjectData'",
      },
      proposed_changes: {
        type: 'string',
        description:
          "Description of the changes you want to make. Examples: 'add description field', 'change status from string to enum', 'rename parameter from projectId to jobId'",
      },
      change_type: {
        type: 'string',
        enum: [
          'add_property',
          'remove_property',
          'rename_property',
          'change_type',
          'function_signature',
          'enum_values',
        ],
        description: 'Type of change being made',
      },
    },
    required: ['interface_name', 'proposed_changes', 'change_type'],
  },
};

const FIND_USAGE_PATTERNS_TOOL_SCHEMA = {
  name: 'codebase.find_usage_patterns',
  description:
    '📋 AI ASSISTANT: REFACTORING ASSISTANT - Find all usages of a symbol before changing it. PREVENTS: missed references, inconsistent updates, broken calls. WHEN TO USE: Before renaming variables/functions, changing enum values, modifying property names, or updating function signatures. Essential for safe refactoring and migrations. 🎯 PERFECT FOR: Finding all places that need updating when you change something.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol_name: {
        type: 'string',
        description:
          "Symbol to find usages of. Examples: 'indexStatus', 'updateIndexingProgress', 'JobStatus.RUNNING', 'project.fileCount'",
      },
      usage_type: {
        type: 'string',
        enum: [
          'all',
          'function_calls',
          'property_access',
          'enum_values',
          'imports',
          'type_annotations',
        ],
        description:
          "Type of usage to find. 'all' finds everything, others are specific usage types.",
      },
      include_similar: {
        type: 'boolean',
        description:
          "Whether to include similar/related symbols that might also need updating. Useful for finding patterns like 'fileCount' when searching for 'vectorCount'.",
      },
    },
    required: ['symbol_name'],
  },
};

const VALIDATE_ENUM_VALUES_TOOL_SCHEMA = {
  name: 'codebase.validate_enum_values',
  description:
    "🎯 AI ASSISTANT: ENUM VALIDATOR - Prevents enum case mismatches and non-existent values. PREVENTS: 'indexing' vs 'INDEXING', 'running' vs 'RUNNING', 'Type CANCELLED is not comparable to IDLE|INDEXING|COMPLETED|ERROR'. WHEN TO USE: Before every enum comparison (status === 'VALUE'), switch cases, enum assignments. CRITICAL when migrating from strings to enums or changing casing. ⚠️ CATCHES: The exact TypeScript enum errors that cause build failures.",
  inputSchema: {
    type: 'object',
    properties: {
      enum_name: {
        type: 'string',
        description: "Name of the enum type. Examples: 'IndexStatus', 'JobStatus', 'TriggerType'",
      },
      value_being_used: {
        type: 'string',
        description:
          "The enum value you're trying to use. Examples: 'COMPLETED', 'indexing', 'running'",
      },
      usage_context: {
        type: 'string',
        description:
          "How you're using this enum value. Examples: 'comparison in if statement', 'assignment to variable', 'function parameter', 'switch case'",
      },
    },
    required: ['enum_name', 'value_being_used', 'usage_context'],
  },
};

const CHECK_FUNCTION_SIGNATURE_TOOL_SCHEMA = {
  name: 'codebase.check_function_signature',
  description:
    "🔧 AI ASSISTANT: FUNCTION SIGNATURE VALIDATOR - Ensures correct parameter names, types, and count. PREVENTS: 'Expected 2 arguments but got 4', 'Property jobId does not exist', 'updateIndexingProgress(projectId) vs updateIndexingProgress(jobId)'. WHEN TO USE: Before every function call during migrations, after changing function parameters, when seeing parameter-related errors. ⚠️ CRITICAL: Validates actual function signature against your intended usage - prevents signature mismatch errors.",
  inputSchema: {
    type: 'object',
    properties: {
      function_name: {
        type: 'string',
        description:
          "Name of the function to validate. Examples: 'updateIndexingProgress', 'startIndexingJob', 'createProject'",
      },
      parameters_attempting: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            value: { type: 'string' },
          },
        },
        description:
          "Array of parameters you're trying to pass. Each should have name, type, and example value.",
      },
      call_context: {
        type: 'string',
        description:
          "Where you're calling this function. Examples: 'in indexing.ts line 150', 'API route handler', 'React component effect'",
      },
    },
    required: ['function_name', 'parameters_attempting', 'call_context'],
  },
};

// Documentation Tools
const DOCS_LIST_REPOSITORIES_TOOL_SCHEMA = {
  name: 'docs.list_repositories',
  description:
    '📚 AI ASSISTANT: List all documentation repositories available for indexing. WHEN TO USE: To see what documentation sources are available, check repository status, or before adding/indexing repositories. Returns repository metadata including indexing status and document counts.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const DOCS_ADD_REPOSITORY_TOOL_SCHEMA = {
  name: 'docs.add_repository',
  description:
    '📝 AI ASSISTANT: Add a new documentation source for indexing. WHEN TO USE: When you want to add comprehensive documentation that MCP clients can search. Supports 3 types: 1) Git repositories (GitHub, GitLab, etc.), 2) llms.txt files (AI-optimized documentation), 3) Websites (documentation sites). Just provide any URL - the system automatically detects the type and extracts relevant information.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description:
          "Any documentation URL. Examples: Git repos ('https://github.com/facebook/react'), llms.txt files ('https://example.com/llms.txt'), or documentation websites ('https://docs.example.com'). The system auto-detects the source type and extracts name, description, languages, and content structure.",
      },
    },
    required: ['url'],
  },
};

const DOCS_INDEX_REPOSITORY_TOOL_SCHEMA = {
  name: 'docs.index_repository',
  description:
    '🚀 AI ASSISTANT: Start indexing a documentation repository. WHEN TO USE: After adding a repository or to re-index updated documentation. This clones the repository and extracts README files, documentation folders, API guides, and code examples for semantic search.',
  inputSchema: {
    type: 'object',
    properties: {
      repository_id: {
        type: 'string',
        description: 'ID of the repository to index (from docs.list_repositories)',
      },
    },
    required: ['repository_id'],
  },
};

const DOCS_SEARCH_TOOL_SCHEMA = {
  name: 'docs.search',
  description:
    '🔍 AI ASSISTANT: Search indexed documentation repositories for specific information. WHEN TO USE: To find API documentation, usage examples, best practices, or technical guides from indexed repositories. Returns relevant documentation snippets with source information.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          "Natural language search query. Examples: 'React useState hook examples', 'TypeScript interface syntax', 'Next.js routing configuration', 'Python async/await patterns'",
      },
      repository_filter: {
        type: 'string',
        description:
          'Optional: Filter results to specific repository name. Use exact repository name from docs.list_repositories.',
      },
      language_filter: {
        type: 'string',
        description:
          "Optional: Filter by programming language. Examples: 'javascript', 'typescript', 'python', 'go'",
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 10)',
      },
    },
    required: ['query'],
  },
};

const HYBRID_SEARCH_TOOL_SCHEMA = {
  name: 'docs.hybrid_search',
  description:
    '🔍 AI ASSISTANT: Advanced hybrid search combining semantic and keyword matching for documentation. WHEN TO USE: For complex queries requiring both conceptual and exact matches. Includes auto-completion, spelling correction, and faceted filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      search_type: {
        type: 'string',
        enum: ['semantic', 'keyword', 'hybrid'],
        description:
          "Search method: 'semantic' for conceptual, 'keyword' for exact matches, 'hybrid' for combined (default)",
      },
      filters: {
        type: 'object',
        properties: {
          content_types: {
            type: 'array',
            items: { type: 'string' },
            description:
              "Filter by content type: 'api', 'tutorial', 'example', 'changelog', 'guide'",
          },
          complexity: {
            type: 'array',
            items: { type: 'string' },
            description: "Filter by complexity: 'beginner', 'intermediate', 'advanced'",
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by programming language',
          },
          freshness: {
            type: 'object',
            properties: {
              min: { type: 'number', description: 'Minimum freshness score (0.0-1.0)' },
              max: { type: 'number', description: 'Maximum freshness score (0.0-1.0)' },
            },
          },
        },
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 10, max: 50)',
      },
    },
    required: ['query'],
  },
};

const SEARCH_SUGGESTIONS_TOOL_SCHEMA = {
  name: 'docs.search_suggestions',
  description:
    '💡 AI ASSISTANT: Get search suggestions, auto-completions, and query enhancements. WHEN TO USE: To help users discover searchable content and improve their queries.',
  inputSchema: {
    type: 'object',
    properties: {
      partial_query: {
        type: 'string',
        description: 'Partial search query for auto-completion',
      },
      suggestion_type: {
        type: 'string',
        enum: ['completion', 'correction', 'expansion', 'related'],
        description: 'Type of suggestions to return',
      },
      limit: {
        type: 'number',
        description: 'Maximum suggestions to return (default: 5)',
      },
    },
    required: ['partial_query'],
  },
};

const RELATIONSHIP_GRAPH_TOOL_SCHEMA = {
  name: 'docs.relationship_graph',
  description:
    '🕸️ AI ASSISTANT: Build interactive documentation relationship network. WHEN TO USE: To visualize connections between documents, find knowledge clusters, and understand content relationships. Creates graph of document similarities, references, imports, and conceptual links.',
  inputSchema: {
    type: 'object',
    properties: {
      options: {
        type: 'object',
        properties: {
          includeWeakRelationships: {
            type: 'boolean',
            description: 'Include relationships with low strength scores (default: false)',
          },
          minStrength: {
            type: 'number',
            description: 'Minimum relationship strength threshold (0.0-1.0, default: 0.3)',
          },
          maxNodes: {
            type: 'number',
            description: 'Maximum number of documents to include in graph (default: 200)',
          },
        },
      },
    },
    required: [],
  },
};

const RELATED_DOCUMENTS_TOOL_SCHEMA = {
  name: 'docs.find_related',
  description:
    '🔗 AI ASSISTANT: Find documents related to a specific document. WHEN TO USE: To discover connected content, build reading paths, and explore document relationships. Returns documents with similarity scores and relationship types.',
  inputSchema: {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'ID of the document to find related documents for',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of related documents to return (default: 10)',
      },
      min_strength: {
        type: 'number',
        description: 'Minimum relationship strength threshold (0.0-1.0, default: 0.3)',
      },
    },
    required: ['document_id'],
  },
};

const FACETED_SEARCH_TOOL_SCHEMA = {
  name: 'docs.faceted_search',
  description:
    '🎛️ AI ASSISTANT: Advanced faceted search with dynamic filters and smart suggestions. WHEN TO USE: For complex searches requiring precise filtering by content type, language, complexity, and other facets. Returns search results with available filters and intelligent suggestions.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      filters: {
        type: 'object',
        description: 'Faceted filters to apply',
        properties: {
          contentTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by content types: api, tutorial, guide, example, etc.',
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by programming languages',
          },
          complexity: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by complexity: beginner, intermediate, advanced',
          },
          sourceTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by source types: git, llmstxt, website',
          },
          freshnessRange: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
            },
            description: 'Filter by content freshness (0.0-1.0)',
          },
          popularityRange: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
            },
            description: 'Filter by popularity score',
          },
          hasExamples: {
            type: 'boolean',
            description: 'Filter by whether content contains code examples',
          },
        },
      },
    },
    required: ['query'],
  },
};

const ALL_TOOLS = [
  CHECK_CONSTRAINTS_TOOL_SCHEMA,
  SET_CONSTRAINTS_TOOL_SCHEMA,
  INGEST_TOOL_SCHEMA,
  RETRIEVE_TOOL_SCHEMA,
  DELETE_SOURCE_TOOL_SCHEMA,
  INDEX_FILE_TOOL_SCHEMA,
  REINDEX_FILE_TOOL_SCHEMA,
  FULL_REINDEX_TOOL_SCHEMA,
  SCHEDULED_INDEXING_TOOL_SCHEMA,
  CLEANUP_PROJECT_TOOL_SCHEMA,
  // Code Validation Tools
  VALIDATE_SYMBOL_TOOL_SCHEMA,
  CHECK_INTERFACE_CHANGES_TOOL_SCHEMA,
  FIND_USAGE_PATTERNS_TOOL_SCHEMA,
  VALIDATE_ENUM_VALUES_TOOL_SCHEMA,
  CHECK_FUNCTION_SIGNATURE_TOOL_SCHEMA,
  // Documentation Tools
  DOCS_LIST_REPOSITORIES_TOOL_SCHEMA,
  DOCS_ADD_REPOSITORY_TOOL_SCHEMA,
  DOCS_INDEX_REPOSITORY_TOOL_SCHEMA,
  DOCS_SEARCH_TOOL_SCHEMA,
  HYBRID_SEARCH_TOOL_SCHEMA,
  SEARCH_SUGGESTIONS_TOOL_SCHEMA,
  // Relationship Analysis Tools (TODO: Implement these)
  // RELATIONSHIP_GRAPH_TOOL_SCHEMA,
  // RELATED_DOCUMENTS_TOOL_SCHEMA,
  // Advanced Search Tools
  // FACETED_SEARCH_TOOL_SCHEMA, // TODO: Re-enable when search-facets module is implemented
];

async function handleMCPRequest(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Incoming MCP request:', body);
    const { method, params, id, jsonrpc } = body;

    // Validate Bearer token authentication
    const authHeader = request.headers.get('Authorization');
    const projectAuth = await validateBearerToken(authHeader);
    
    const projectId = projectAuth?.projectId || null;
    const project = projectAuth ? {
      id: projectAuth.projectId,
      name: projectAuth.projectName,
      gitRepo: projectAuth.gitRepo,
    } : null;

    // Helper function to check project authentication (now simplified)
    const requireProjectAuth = () => {
      if (!projectId || !project) {
        throw new Error('Authentication required: Valid project token must be provided via Authorization header');
      }
      return { projectId, project };
    };

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Missing or invalid jsonrpc version',
          },
          id: id || null,
        },
        { status: 400 }
      );
    }

    if (!method) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Missing method',
          },
          id: id || null,
        },
        { status: 400 }
      );
    }

    switch (method) {
      case 'initialize':
        console.log('Incoming initialize request:', params);
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: params?.protocolVersion || '2024-11-05',
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: 'ideamem-mcp',
              version: '1.0.0',
            },
          },
          id: body.id,
        });

      case 'notifications/initialized':
        console.log('Incoming initialized notification.');
        // This is a notification, no response expected.
        return new NextResponse(null, { status: 204 }); // 204 No Content

      case 'tools/list':
        console.log('Incoming tools/list request.');
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            tools: ALL_TOOLS,
          },
          id: body.id,
        });

      case 'shutdown':
        console.log('Incoming shutdown request.');
        // Perform any cleanup here if necessary
        return NextResponse.json({ jsonrpc: '2.0', result: {}, id: body.id });

      case 'exit':
        console.log('Incoming exit request.');
        // Exit the process. In a serverless environment, this might just mean returning.
        // For a local dev server, this might actually terminate the process.
        // For now, just return success.
        return NextResponse.json({ jsonrpc: '2.0', result: {}, id: body.id });

      case 'tools/call':
        if (!params || !params.name) {
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Invalid params',
                data: 'Missing tool name',
              },
              id: body.id,
            },
            { status: 400 }
          );
        }

        const { name, arguments: toolArgs } = params;

        try {
          // Validate tool arguments with Zod if schema exists
          let validatedArgs = toolArgs;
          if (name in MCPToolSchemas) {
            try {
              validatedArgs = validateToolArguments(name as MCPToolName, toolArgs || {});
            } catch (validationError) {
              if (validationError instanceof z.ZodError) {
                return NextResponse.json(
                  {
                    jsonrpc: '2.0',
                    error: {
                      code: -32602,
                      message: 'Invalid arguments',
                      data: validationError.issues,
                    },
                    id: body.id,
                  },
                  { status: 400 }
                );
              }
              throw validationError;
            }
          }
          
          let result;
          switch (name) {
            case 'codebase.store':
              if (!validatedArgs) throw new Error('Missing arguments for codebase.store');
              const { projectId: storeProjectId } = requireProjectAuth();
              result = await ingest({ ...validatedArgs, project_id: storeProjectId });
              break;
            case 'codebase.search':
              if (!validatedArgs) throw new Error('Missing arguments for codebase.search');
              const { projectId: searchProjectId } = requireProjectAuth();
              result = await retrieve({ ...validatedArgs, project_id: searchProjectId });
              // Track query for metrics
              trackQuery(searchProjectId).catch((err) => console.warn('Failed to track query:', err));
              break;
            case 'codebase.forget':
              if (!validatedArgs) throw new Error('Missing arguments for codebase.forget');
              const { projectId: forgetProjectId } = requireProjectAuth();
              result = await deleteSource({ ...validatedArgs, project_id: forgetProjectId });
              break;
            case 'codebase.index_file':
              if (!validatedArgs) throw new Error('Missing arguments for codebase.index_file');
              const { projectId: authProjectId, project: authProject } = requireProjectAuth();
              result = await indexSingleFile(
                authProjectId,
                authProject.gitRepo,
                validatedArgs.file_path,
                validatedArgs.branch || 'main'
              );
              break;
            case 'codebase.refresh_file':
              if (!validatedArgs) throw new Error('Missing arguments for codebase.refresh_file');
              const { projectId: refreshProjectId, project: refreshProject } = requireProjectAuth();
              result = await reindexSingleFile(
                refreshProjectId,
                refreshProject.gitRepo,
                validatedArgs.file_path,
                validatedArgs.branch || 'main'
              );
              break;
            case 'codebase.rebuild_all':
              const { projectId: rebuildProjectId, project: rebuildProject } = requireProjectAuth();
              result = await fullReindex(rebuildProjectId, rebuildProject.gitRepo, validatedArgs?.branch || 'main');
              break;
            case 'codebase.sync_changes':
              const { projectId: syncProjectId, project: syncProject } = requireProjectAuth();
              result = await scheduledIncrementalIndexing(
                syncProjectId,
                syncProject.gitRepo,
                validatedArgs?.branch || 'main'
              );
              break;
            case 'codebase.check_constraints':
              // Smart constraint checking with PROJECT PRIORITY - project rules override global ones
              const { projectId: constraintProjectId } = requireProjectAuth();
              
              try {
                // Get project-specific constraints from unified API
                const projectConstraintsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/projects/${constraintProjectId}/constraints`);
                
                const projectConstraintsData = projectConstraintsResponse.ok ? await projectConstraintsResponse.json() : {};
                const projectConstraints = projectConstraintsData.data?.constraints || [];

                // Get global constraints as fallback
                const globalConstraintsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/global/constraints`);
                
                const globalConstraintsData = globalConstraintsResponse.ok ? await globalConstraintsResponse.json() : {};
                const globalConstraints = globalConstraintsData.data?.constraints || [];

                // Merge with project taking precedence (project constraints come first)
                const allConstraints = [...projectConstraints, ...globalConstraints];

                // Organize constraints by category
                const categorizedConstraints = {
                  rule: allConstraints.filter(c => c.payload.category === 'rule'),
                  tooling: allConstraints.filter(c => c.payload.category === 'tooling'),  
                  workflow: allConstraints.filter(c => c.payload.category === 'workflow'),
                  formatting: allConstraints.filter(c => c.payload.category === 'formatting'),
                };

                result = {
                  constraints: allConstraints.map(c => ({
                    source: c.payload.source,
                    content: c.payload.content,
                    category: c.payload.category,
                    scope: c.payload.scope,
                    id: c.id
                  })),
                  categories: categorizedConstraints,
                  category_counts: {
                    rule: categorizedConstraints.rule.length,
                    tooling: categorizedConstraints.tooling.length,
                    workflow: categorizedConstraints.workflow.length,
                    formatting: categorizedConstraints.formatting.length,
                  },
                  priority_info: {
                    project_constraints_count: projectConstraints.length,
                    global_constraints_count: globalConstraints.length,
                  },
                  summary: `Found ${allConstraints.length} constraints (${projectConstraints.length} project-specific, ${globalConstraints.length} global). PROJECT CONSTRAINTS OVERRIDE GLOBAL CONSTRAINTS.`,
                  category_breakdown: `Rule: ${categorizedConstraints.rule.length}, Tooling: ${categorizedConstraints.tooling.length}, Workflow: ${categorizedConstraints.workflow.length}, Formatting: ${categorizedConstraints.formatting.length}`,
                  workflow_reminder:
                    '🚨 CRITICAL: Project-specific constraints take precedence over global ones. All constraints are organized by category (rule, tooling, workflow, formatting).',
                };
              } catch (error) {
                result = {
                  constraints: [],
                  categories: { rule: [], tooling: [], workflow: [], formatting: [] },
                  error: `Failed to fetch constraints from database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  summary: 'Failed to load constraints from database. Using empty constraints.',
                };
              }
              break;
            case 'codebase.set_constraints':
              if (!toolArgs) throw new Error('Missing arguments for codebase.set_constraints');
              const { projectId: setConstraintsProjectId } = requireProjectAuth();
              
              try {
                const scope = toolArgs.scope || 'global';
                const isGlobal = scope === 'global';
                
                // Use unified constraints API
                const endpoint = isGlobal 
                  ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/global/constraints`
                  : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/projects/${setConstraintsProjectId}/constraints`;
                
                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    source: toolArgs.source,
                    content: toolArgs.content,
                    category: toolArgs.category || 'rule'
                  })
                });
                
                if (!response.ok) {
                  const errorData = await response.text();
                  throw new Error(`Failed to store constraint: ${response.statusText} - ${errorData}`);
                }
                
                const data = await response.json();
                const constraintId = data.data?.constraint?.id;
                
                result = {
                  success: true,
                  message: `Constraint (${toolArgs.category}) stored successfully in database`,
                  constraint_id: constraintId,
                  source: toolArgs.source,
                  category: toolArgs.category,
                  scope: scope,
                  workflow_tip: `Use 'codebase.check_constraints' before coding to ensure compliance with this ${toolArgs.category} constraint.`
                };
              } catch (error) {
                result = {
                  success: false,
                  error: `Failed to store constraint in database: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  troubleshooting: 'Check that the database API endpoints are accessible and the constraint data is valid.'
                };
              }
              break;
            case 'codebase.cleanup_project':
              if (!toolArgs) throw new Error('Missing arguments for codebase.cleanup_project');
              const { projectId: cleanupProjectId, project: cleanupProject } = requireProjectAuth();

              console.log(`Emergency cleanup requested for project ${cleanupProjectId}`);
              const cleanupResult = await deleteAllProjectVectors(cleanupProjectId);

              result = {
                success: cleanupResult.success,
                deleted_count: cleanupResult.deleted_count,
                project_id: cleanupProjectId,
                message: `Successfully cleaned up all vectors for project ${cleanupProjectId}. This project's search index has been completely reset.`,
                warning:
                  'All indexed content for this project has been permanently removed. You may want to run a full reindex to restore the search functionality.',
              };
              break;

            // Code Validation Tools
            case 'codebase.validate_symbol':
              if (!toolArgs) throw new Error('Missing arguments for codebase.validate_symbol');
              const { projectId: symbolProjectId } = requireProjectAuth();
              const symbolQuery = `symbol definition ${toolArgs.symbol_name} ${toolArgs.expected_type || ''} ${toolArgs.context}`;
              const symbolResults = await retrieve({
                query: symbolQuery,
                project_id: symbolProjectId,
              });

              result = {
                symbol_name: toolArgs.symbol_name,
                found: (symbolResults || []).length > 0,
                matches: (symbolResults || []).map((r: SearchResult) => ({
                  source: r.payload?.source || 'unknown',
                  type: r.payload?.type || 'unknown',
                  snippet: (r.payload?.content || r.content || '').substring(0, 200),
                  similarity: r.score,
                })),
                validation_status: (symbolResults || []).length > 0 ? 'VALID' : 'NOT_FOUND',
                suggestions:
                  (symbolResults || []).length === 0
                    ? 'Symbol not found. Check spelling, imports, or search for similar symbols.'
                    : 'Symbol found and validated.',
              };
              break;

            case 'codebase.check_interface_changes':
              if (!toolArgs)
                throw new Error('Missing arguments for codebase.check_interface_changes');
              const { projectId: interfaceProjectId } = requireProjectAuth();
              const interfaceQuery = `interface type ${toolArgs.interface_name} definition properties fields`;
              const interfaceResults = await retrieve({
                query: interfaceQuery,
                project_id: interfaceProjectId,
              });

              result = {
                interface_name: toolArgs.interface_name,
                current_definition_found: (interfaceResults || []).length > 0,
                proposed_changes: toolArgs.proposed_changes,
                change_type: toolArgs.change_type,
                current_definitions: (interfaceResults || []).map((r: SearchResult) => ({
                  source: r.payload?.source || 'unknown',
                  content: r.payload?.content || r.content || '',
                  similarity: r.score,
                })),
                impact_warning:
                  'Review all usages of this interface before making changes. Breaking changes may require updating multiple files.',
                next_step:
                  'Use codebase.find_usage_patterns to find all places that use this interface.',
              };
              break;

            case 'codebase.find_usage_patterns':
              if (!toolArgs) throw new Error('Missing arguments for codebase.find_usage_patterns');
              let usageQuery = toolArgs.symbol_name;

              // Enhance query based on usage type
              switch (toolArgs.usage_type) {
                case 'function_calls':
                  usageQuery += ' function call invocation';
                  break;
                case 'property_access':
                  usageQuery += ' property access dot notation';
                  break;
                case 'enum_values':
                  usageQuery += ' enum value comparison assignment';
                  break;
                case 'imports':
                  usageQuery += ' import statement require';
                  break;
                case 'type_annotations':
                  usageQuery += ' type annotation interface';
                  break;
              }

              const { projectId: usageProjectId } = requireProjectAuth();
              const usageResults = await retrieve({
                query: usageQuery,
                project_id: usageProjectId,
              });

              result = {
                symbol_name: toolArgs.symbol_name,
                usage_type: toolArgs.usage_type || 'all',
                total_usages_found: (usageResults || []).length,
                usages: (usageResults || []).map((r: SearchResult) => ({
                  file: r.payload?.source || 'unknown',
                  content: r.payload?.content || r.content || '',
                  type: r.payload?.type || 'unknown',
                  similarity: r.score,
                })),
                refactoring_checklist:
                  (usageResults || []).length > 0
                    ? `Found ${(usageResults || []).length} usages. Update all these locations when changing ${toolArgs.symbol_name}.`
                    : 'No usages found. Symbol might be safe to change or not indexed yet.',
              };
              break;

            case 'codebase.validate_enum_values':
              if (!toolArgs) throw new Error('Missing arguments for codebase.validate_enum_values');
              const { projectId: enumProjectId } = requireProjectAuth();
              const enumQuery = `enum ${toolArgs.enum_name} values ${toolArgs.value_being_used}`;
              const enumResults = await retrieve({
                query: enumQuery,
                project_id: enumProjectId,
              });

              result = {
                enum_name: toolArgs.enum_name,
                value_being_used: toolArgs.value_being_used,
                usage_context: toolArgs.usage_context,
                enum_found: (enumResults || []).length > 0,
                valid_values: (enumResults || []).map((r: SearchResult) => {
                  // Extract enum values from the content
                  const content = r.payload?.content || r.content || '';
                  const enumMatches = content.match(/enum\s+\w+\s*{([^}]*)}/g);
                  return {
                    source: r.payload?.source || 'unknown',
                    content: content,
                    similarity: r.score,
                  };
                }),
                validation_result: (enumResults || []).some((r) =>
                  r.payload?.content || r.content || ''.includes(toolArgs.value_being_used)
                )
                  ? 'VALID'
                  : 'INVALID',
                suggestions: 'Check the actual enum definition for correct values and casing.',
              };
              break;

            case 'codebase.check_function_signature':
              if (!toolArgs)
                throw new Error('Missing arguments for codebase.check_function_signature');
              const { projectId: funcProjectId } = requireProjectAuth();
              const funcQuery = `function ${toolArgs.function_name} parameters signature definition`;
              const funcResults = await retrieve({
                query: funcQuery,
                project_id: funcProjectId,
              });

              result = {
                function_name: toolArgs.function_name,
                parameters_attempting: toolArgs.parameters_attempting,
                call_context: toolArgs.call_context,
                function_found: (funcResults || []).length > 0,
                function_definitions: (funcResults || []).map((r: SearchResult) => ({
                  source: r.payload?.source || 'unknown',
                  signature: r.payload?.content || r.content || '',
                  similarity: r.score,
                })),
                validation_status: (funcResults || []).length > 0 ? 'FOUND' : 'NOT_FOUND',
                recommendations:
                  (funcResults || []).length > 0
                    ? 'Compare your parameters with the actual function signature above.'
                    : 'Function not found. Check function name spelling or imports.',
              };
              break;

            // Documentation Tools
            case 'docs.list_repositories':
              const repos = await (async () => {
                try {
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/global/docs/repositories`
                  );
                  const data = await response.json();
                  return data.repositories || [];
                } catch (error) {
                  console.error('Error fetching repositories:', error);
                  return [];
                }
              })();
              result = { repositories: repos };
              break;

            case 'docs.add_repository':
              if (!toolArgs) throw new Error('Missing arguments for docs.add_repository');
              const addResponse = await (async () => {
                try {
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/global/docs/repositories`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: toolArgs.url,
                      }),
                    }
                  );
                  return await response.json();
                } catch (error) {
                  return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                  };
                }
              })();
              result = addResponse;
              break;

            case 'docs.index_repository':
              if (!toolArgs) throw new Error('Missing arguments for docs.index_repository');
              const indexResponse = await (async () => {
                try {
                  const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/global/docs/index`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ repositoryId: toolArgs.repository_id }),
                    }
                  );
                  return await response.json();
                } catch (error) {
                  return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                  };
                }
              })();
              result = indexResponse;
              break;

            case 'docs.search':
              if (!toolArgs) throw new Error('Missing arguments for docs.search');

              // Generate cache key for search
              const searchFilters = {
                type: 'documentation',
                ...(toolArgs.language_filter && { language: toolArgs.language_filter }),
                ...(toolArgs.repository_filter && { source: toolArgs.repository_filter }),
              };
              const searchHash = SearchResultsCache.generateQueryHash(
                toolArgs.query,
                searchFilters
              );

              // Check cache first
              const cachedResults = await SearchResultsCache.get(searchHash);
              let searchResults;
              let searchTime = 0;

              if (cachedResults) {
                console.log(`Using cached search results for: ${toolArgs.query}`);
                console.log('Cached results structure:', JSON.stringify(cachedResults, null, 2));
                searchResults = cachedResults.results;
                searchTime = cachedResults.metadata.searchTime;
              } else {
                // Perform fresh search
                const startTime = Date.now();
                searchResults = await retrieve({
                  query: toolArgs.query,
                  project_id: 'global',
                  filters: searchFilters,
                });
                searchTime = Date.now() - startTime;

                // Debug logging for search results structure
                if (searchResults && searchResults.length > 0) {
                  console.log(
                    'Sample search result structure:',
                    JSON.stringify(searchResults[0], null, 2)
                  );
                } else {
                  console.log('No search results found for query:', toolArgs.query);
                }

                // Cache the results
                await SearchResultsCache.set(
                  searchHash,
                  searchResults || [],
                  {
                    totalResults: (searchResults || []).length,
                    searchTime,
                  },
                  60 * 60 // 1 hour TTL
                );
              }

              const limitedResults = (searchResults || []).slice(0, toolArgs.limit || 5);
              const mappedResults = limitedResults.map((r: SearchResult) => ({
                content: r.payload?.content || r.content || '',
                source: r.payload?.source || r.metadata?.source || 'unknown',
                repository:
                  (r.payload?.source || r.metadata?.source || '').split('/')[0] || 'unknown',
                file_path:
                  (r.payload?.source || r.metadata?.source || '').split('/').slice(1).join('/') ||
                  '',
                language: r.payload?.language || r.metadata?.language || 'unknown',
                similarity: r.score || r.similarity || 0,
                type: r.payload?.type || r.metadata?.type || 'documentation',
              }));

              result = {
                query: toolArgs.query,
                total_results: (searchResults || []).length,
                search_time_ms: searchTime,
                cached: !!cachedResults,
                results: mappedResults,
              };

              console.log('Final MCP result structure:', JSON.stringify(result, null, 2));
              break;

            case 'docs.hybrid_search':
              if (!toolArgs) throw new Error('Missing arguments for docs.hybrid_search');

              const hybridSearchResult = await HybridSearchEngine.search(
                toolArgs.query,
                toolArgs.filters || {},
                {
                  searchType: toolArgs.search_type || 'hybrid',
                  limit: toolArgs.limit || 10,
                }
              );

              result = hybridSearchResult;
              break;

            case 'docs.search_suggestions':
              if (!toolArgs) throw new Error('Missing arguments for docs.search_suggestions');

              let suggestions: unknown[] = [];

              switch (toolArgs.suggestion_type || 'completion') {
                case 'completion':
                  suggestions = await QueryEnhancer.getAutoCompletions(
                    toolArgs.partial_query,
                    toolArgs.limit || 5
                  );
                  break;

                case 'correction':
                  suggestions = await QueryEnhancer.getSpellingCorrections(toolArgs.partial_query);
                  break;

                case 'expansion':
                  const expansion = await QueryEnhancer.expandQuery(toolArgs.partial_query);
                  suggestions = expansion.expandedQueries.map((q) => ({
                    text: q,
                    type: 'expansion',
                    confidence: 0.8,
                  }));
                  break;

                case 'related':
                  const relatedExpansion = await QueryEnhancer.expandQuery(toolArgs.partial_query);
                  suggestions = relatedExpansion.relatedTerms.map((term) => ({
                    text: term,
                    type: 'related',
                    confidence: 0.7,
                  }));
                  break;
              }

              result = {
                partial_query: toolArgs.partial_query,
                suggestion_type: toolArgs.suggestion_type || 'completion',
                suggestions,
                query_analysis: QueryEnhancer.analyzeQuery(toolArgs.partial_query),
              };
              break;


            case 'docs.faceted_search':
              // TODO: Implement faceted search when search-facets module is created
              throw new Error('docs.faceted_search is not yet implemented');
              break;

            default:
              return NextResponse.json(
                {
                  jsonrpc: '2.0',
                  error: {
                    code: -32601,
                    message: 'Method not found',
                    data: `Unknown tool: ${name}`,
                  },
                  id: body.id,
                },
                { status: 400 }
              );
          }

          return NextResponse.json({
            jsonrpc: '2.0',
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
            id: body.id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal error',
                data: errorMessage,
              },
              id: body.id,
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Unknown method: ${method}`,
            },
            id: body.id,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('MCP API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: errorMessage,
        },
        id: null,
      },
      { status: 500 }
    );
  }
}

// Export with middleware applied
export const POST = MiddlewareStacks.api(handleMCPRequest);
