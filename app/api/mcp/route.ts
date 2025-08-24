import { NextResponse } from 'next/server';
import { ingest, retrieve, deleteSource, listProjects } from '@/lib/memory';
import { trackQuery, getProjectByToken } from '@/lib/projects';

// Define ToolSchema objects for our custom methods
const INGEST_TOOL_SCHEMA = {
  name: "memory.ingest",
  description: "Stores and indexes content in the semantic memory system using vector embeddings. Supports intelligent chunking for code (AST-based for JS/TS) and content-aware segmentation for documentation. Use this to build a searchable knowledge base of code, documentation, conversations, and rules. Returns success status and number of vectors created.",
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
  name: "memory.retrieve",
  description: "Performs semantic search across the indexed memory to find relevant content based on natural language queries. Returns up to 5 most similar content chunks with metadata, source information, and similarity scores. Supports filtering by content type, source, language, or custom metadata to narrow search scope.",
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
  name: "memory.delete_source",
  description: "Removes all indexed content chunks that originated from a specific source identifier. This is a bulk deletion operation useful for cleaning up outdated content, removing deleted files, or preparing to re-ingest updated content. All vector embeddings with the matching source will be permanently deleted from the memory system.",
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
  name: "memory.list_projects",
  description: "Lists all project identifiers that have content stored in the memory system. Returns a list of unique project_id values found in the vector database. Use this to discover available projects or verify project identifiers before performing project-specific operations.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
};

const ALL_TOOLS = [
  INGEST_TOOL_SCHEMA,
  RETRIEVE_TOOL_SCHEMA,
  DELETE_SOURCE_TOOL_SCHEMA,
  LIST_PROJECTS_TOOL_SCHEMA
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
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const project = await getProjectByToken(token);
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
            case 'memory.ingest':
              if (!toolArgs) throw new Error('Missing arguments for memory.ingest');
              result = await ingest(toolArgs);
              break;
            case 'memory.retrieve':
              if (!toolArgs) throw new Error('Missing arguments for memory.retrieve');
              result = await retrieve(toolArgs);
              // Track query for metrics
              if (projectId) {
                trackQuery(projectId).catch(err => 
                  console.warn('Failed to track query:', err)
                );
              }
              break;
            case 'memory.delete_source':
              if (!toolArgs) throw new Error('Missing arguments for memory.delete_source');
              result = await deleteSource(toolArgs);
              break;
            case 'memory.list_projects':
              result = await listProjects();
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