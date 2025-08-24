import { NextResponse } from 'next/server';
import { ingest, retrieve, deleteSource, listProjects } from '@/lib/memory';
import { trackQuery, getProjectByToken } from '@/lib/projects';
import { indexSingleFile, reindexSingleFile, fullReindex, scheduledIncrementalIndexing } from '@/lib/indexing';

// Define ToolSchema objects for our custom methods
const INGEST_TOOL_SCHEMA = {
  name: "codebase.store",
  description: "🤖 AI ASSISTANT: Store code/docs for future semantic search. WHEN TO USE: After reading important files, discovering key implementations, or learning new patterns. Creates searchable knowledge base. 💡 TIP: Use this when you find solutions, patterns, or important code - makes future searches much more effective than re-reading files.",
  inputSchema: {
    type: "object",
    properties: {
      content: { 
        type: "string", 
        description: "The raw text or code content to be ingested. Can be entire files, code snippets, documentation sections, or conversation transcripts. For code, functions and classes will be automatically extracted and chunked separately. Examples: source code files, README content, API documentation, chat conversations." 
      },
      source: { 
        type: "string", 
        description: "Unique identifier for the content origin. Use consistent naming like file paths (src/components/Button.tsx), URLs (github.com/user/repo/README.md), or identifiers (conversation-2024-01-15). This is used for updates and deletions, so keep it stable and unique." 
      },
      type: { 
        type: "string", 
        enum: ["code", "documentation", "conversation", "user_preference", "rule"], 
        description: "Content category that affects processing: 'code' enables AST parsing for JS/TS with function/class extraction, 'documentation' for guides/specs/READMEs, 'conversation' for chat logs/discussions, 'user_preference' for settings/configurations, 'rule' for business rules and coding constraints." 
      },
      language: { 
        type: "string", 
        description: "Programming language (typescript, javascript, python, rust, go, java, c, cpp, etc.) or markup language (markdown, html, json, yaml, xml, etc.). For code content, determines parsing strategy. Use 'text' for plain text content. Be specific for better chunking." 
      },
      project_id: {
        type: "string",
        description: "Project identifier for isolation. Use unique IDs like 'my-project-name' or UUIDs. If not provided, content is stored in global scope accessible across all projects."
      },
      scope: {
        type: "string",
        enum: ["global", "project"],
        description: "Storage scope: 'global' for cross-project accessibility (default), 'project' for project-specific content. When scope='project', project_id is required."
      }
    },
    required: ["content", "source", "type", "language"]
  }
};

const RETRIEVE_TOOL_SCHEMA = {
  name: "codebase.search",
  description: "🔍 AI ASSISTANT: SEARCH FIRST before Read/Grep! Finds code by meaning, not just keywords. EXAMPLES: 'authentication patterns', 'error handling in APIs', 'React component lifecycle', 'database queries', 'webhook validation'. 🚀 MUCH FASTER than grep - understands context, finds similar implementations even with different names.",
  inputSchema: {
    type: "object",
    properties: {
      query: { 
        type: "string", 
        description: "Natural language query describing what you're looking for. Can be conceptual ('authentication logic', 'error handling patterns'), specific ('how to calculate cart total', 'user login function'), or technical ('React components that handle forms', 'API endpoints for user management'). More specific and detailed queries yield better results." 
      },
      filters: { 
        type: "object", 
        description: "Optional key-value filters to narrow search scope. Common patterns: {\"type\": \"code\"} for code only, {\"language\": \"typescript\"} for specific language, {\"source\": \"src/components/\"} for source path matching. Multiple filters are AND-combined. Filter keys: 'type', 'language', 'source'.", 
        additionalProperties: true,
        properties: {
          type: { type: "string", enum: ["code", "documentation", "conversation", "user_preference", "rule"], description: "Filter by content type" },
          language: { type: "string", description: "Filter by programming/markup language" },
          source: { type: "string", description: "Filter by source path/identifier (supports partial matching)" }
        }
      },
      project_id: {
        type: "string",
        description: "Project identifier to search within. If not provided, searches global scope only."
      },
      scope: {
        type: "string",
        enum: ["global", "project", "all"],
        description: "Search scope: 'global' searches only global content, 'project' searches only project-specific content (requires project_id), 'all' searches both global and project content."
      }
    },
    required: ["query"]
  }
};

const DELETE_SOURCE_TOOL_SCHEMA = {
  name: "codebase.forget",
  description: "🗑️ AI ASSISTANT: Remove outdated/deleted code from search index. WHEN TO USE: After deleting files, major refactors, or when search returns obsolete results. Keeps search results clean and current. 💡 TIP: Use before re-indexing renamed or moved files.",
  inputSchema: {
    type: "object",
    properties: {
      source: { 
        type: "string", 
        description: "Exact source identifier to delete. Must match the 'source' field used during ingestion exactly (case-sensitive). Examples: 'src/components/Button.tsx', 'docs/api.md', 'conversation-2024-01-15'. Use memory.retrieve first to verify exact source names if unsure. Partial matches are not supported." 
      },
      project_id: {
        type: "string",
        description: "Project identifier for the source to delete. If not provided, deletes from global scope."
      },
      scope: {
        type: "string",
        enum: ["global", "project"],
        description: "Scope to delete from: 'global' for global content, 'project' for project-specific content (requires project_id)."
      }
    },
    required: ["source"]
  }
};

const LIST_PROJECTS_TOOL_SCHEMA = {
  name: "codebase.list_projects", 
  description: "📋 AI ASSISTANT: List all searchable projects. WHEN TO USE: Starting work on unfamiliar codebase, checking what's available to search, or verifying project scope. Shows which codebases have indexed content.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

const INDEX_FILE_TOOL_SCHEMA = {
  name: "codebase.index_file",
  description: "⚡ AI ASSISTANT: Make specific file searchable NOW. WHEN TO USE: Just wrote important code, created key components, or added crucial docs. Makes it immediately findable for future searches. 🎯 PERFECT FOR: New implementations, important utilities, API endpoints you'll reference later.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { 
        type: "string", 
        description: "Project identifier where the file should be indexed" 
      },
      file_path: { 
        type: "string", 
        description: "Relative path to the file within the repository (e.g., 'src/components/Button.tsx', 'README.md')" 
      },
      branch: { 
        type: "string", 
        description: "Git branch to index from (default: 'main')" 
      }
    },
    required: ["project_id", "file_path"]
  }
};

const REINDEX_FILE_TOOL_SCHEMA = {
  name: "codebase.refresh_file",
  description: "🔄 AI ASSISTANT: Refresh outdated file in search index. WHEN TO USE: After major edits to important files, when search returns old versions, or after refactoring. Updates the searchable version to match current code. 💡 BETTER than full reindex - targets specific files.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { 
        type: "string", 
        description: "Project identifier where the file should be reindexed" 
      },
      file_path: { 
        type: "string", 
        description: "Relative path to the file within the repository (e.g., 'src/components/Button.tsx', 'README.md')" 
      },
      branch: { 
        type: "string", 
        description: "Git branch to reindex from (default: 'main')" 
      }
    },
    required: ["project_id", "file_path"]
  }
};

const FULL_REINDEX_TOOL_SCHEMA = {
  name: "codebase.rebuild_all",
  description: "🔨 AI ASSISTANT: Rebuild entire project search index from scratch. WHEN TO USE: After major refactoring, when searches consistently return wrong results, or starting fresh. NUCLEAR OPTION - use sparingly. ⚠️ SLOW but thorough - rebuilds complete searchable knowledge base.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { 
        type: "string", 
        description: "Project identifier to fully reindex" 
      },
      branch: { 
        type: "string", 
        description: "Git branch to reindex from (default: 'main')" 
      }
    },
    required: ["project_id"]
  }
};

const SCHEDULED_INDEXING_TOOL_SCHEMA = {
  name: "codebase.sync_changes",
  description: "🤖 AI ASSISTANT: Smart sync - only indexes NEW changes. WHEN TO USE: Want to ensure search is current, working on active codebase, or periodic maintenance. SUPER EFFICIENT - skips if no changes, only processes modified files. 🎯 PERFECT FOR: Development workflows.",
  inputSchema: {
    type: "object",
    properties: {
      project_id: { 
        type: "string", 
        description: "Project identifier to check and index" 
      },
      branch: { 
        type: "string", 
        description: "Git branch to check for changes (default: 'main')" 
      }
    },
    required: ["project_id"]
  }
};

const ALL_TOOLS = [
  INGEST_TOOL_SCHEMA,
  RETRIEVE_TOOL_SCHEMA,
  DELETE_SOURCE_TOOL_SCHEMA,
  LIST_PROJECTS_TOOL_SCHEMA,
  INDEX_FILE_TOOL_SCHEMA,
  REINDEX_FILE_TOOL_SCHEMA,
  FULL_REINDEX_TOOL_SCHEMA,
  SCHEDULED_INDEXING_TOOL_SCHEMA
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Incoming MCP request:', body);
    const { method, params, id, jsonrpc } = body;
    
    // Extract project authentication info
    const authHeader = request.headers.get('Authorization');
    const projectIdHeader = request.headers.get('X-Project-ID');
    let projectId: string | null = null;
    let project: any = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      project = await getProjectByToken(token);
      if (project) {
        projectId = project.id;
      }
    }

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Missing or invalid jsonrpc version'
        },
        id: id || null
      }, { status: 400 });
    }

    if (!method) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Missing method'
        },
        id: id || null
      }, { status: 400 });
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
                listChanged: false
              }
            },
            serverInfo: {
              name: 'ideamem-mcp',
              version: '1.0.0'
            }
          },
          id: body.id
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
            tools: ALL_TOOLS
          },
          id: body.id
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
          return NextResponse.json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid params',
              data: 'Missing tool name'
            },
            id: body.id
          }, { status: 400 });
        }

        const { name, arguments: toolArgs } = params;
        
        try {
          let result;
          switch (name) {
            case 'codebase.store':
              if (!toolArgs) throw new Error('Missing arguments for codebase.store');
              result = await ingest(toolArgs);
              break;
            case 'codebase.search':
              if (!toolArgs) throw new Error('Missing arguments for codebase.search');
              result = await retrieve(toolArgs);
              // Track query for metrics
              if (projectId) {
                trackQuery(projectId).catch(err => 
                  console.warn('Failed to track query:', err)
                );
              }
              break;
            case 'codebase.forget':
              if (!toolArgs) throw new Error('Missing arguments for codebase.forget');
              result = await deleteSource(toolArgs);
              break;
            case 'codebase.list_projects':
              result = await listProjects();
              break;
            case 'codebase.index_file':
              if (!toolArgs) throw new Error('Missing arguments for codebase.index_file');
              if (!projectId || !project) throw new Error('Project authentication required for indexing operations');
              result = await indexSingleFile(
                projectId,
                project.gitRepo,
                toolArgs.file_path,
                toolArgs.branch || 'main'
              );
              break;
            case 'codebase.refresh_file':
              if (!toolArgs) throw new Error('Missing arguments for codebase.refresh_file');
              if (!projectId || !project) throw new Error('Project authentication required for indexing operations');
              result = await reindexSingleFile(
                projectId,
                project.gitRepo,
                toolArgs.file_path,
                toolArgs.branch || 'main'
              );
              break;
            case 'codebase.rebuild_all':
              if (!toolArgs) throw new Error('Missing arguments for codebase.rebuild_all');
              if (!projectId || !project) throw new Error('Project authentication required for indexing operations');
              result = await fullReindex(
                projectId,
                project.gitRepo,
                toolArgs.branch || 'main'
              );
              break;
            case 'codebase.sync_changes':
              if (!toolArgs) throw new Error('Missing arguments for codebase.sync_changes');
              if (!projectId || !project) throw new Error('Project authentication required for indexing operations');
              result = await scheduledIncrementalIndexing(
                projectId,
                project.gitRepo,
                toolArgs.branch || 'main'
              );
              break;
            default:
              return NextResponse.json({
                jsonrpc: '2.0',
                error: {
                  code: -32601,
                  message: 'Method not found',
                  data: `Unknown tool: ${name}`
                },
                id: body.id
              }, { status: 400 });
          }
          
          return NextResponse.json({
            jsonrpc: '2.0',
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            },
            id: body.id
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          return NextResponse.json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error',
              data: errorMessage
            },
            id: body.id
          }, { status: 500 });
        }

      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unknown method: ${method}`
          },
          id: body.id
        }, { status: 400 });
    }
  } catch (error) {
    console.error('MCP API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
        data: errorMessage
      },
      id: null
    }, { status: 500 });
  }
}