# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaMem is a Next.js application that implements an MCP (Model Context Protocol) server for semantic memory operations. The system uses vector embeddings to store and retrieve code, documentation, and other content via Qdrant (vector database) and Ollama (local LLM for embeddings).

## Architecture

### Core Components
- **Configuration System** (`lib/config.ts`): Manages connection URLs for Qdrant and Ollama services with JSON-based config persistence
- **Memory System** (`lib/memory.ts`): Core functionality for ingesting, retrieving, and managing vector embeddings
- **MCP Server** (`app/api/mcp/route.ts`): REST API implementing Model Context Protocol for memory operations
- **Admin Interface** (`app/admin/page.tsx`): Web UI for service configuration and health monitoring
- **Test Interface** (`app/test-mcp/page.tsx`): Development UI for testing MCP operations

### Data Flow
1. Content is ingested via MCP API with semantic chunking (AST-based for code)
2. Text chunks are converted to embeddings using Ollama's `nomic-embed-text` model
3. Embeddings stored in Qdrant with metadata (source, type, language)
4. Retrieval uses similarity search against query embeddings

### External Dependencies
- **Qdrant**: Vector database for embedding storage (default: localhost:6333)
- **Ollama**: Local LLM service with `nomic-embed-text` model (default: localhost:11434)

## Development Commands

### Build and Development
```bash
# Development server
pnpm dev

# Production build
pnpm build

# Production start
pnpm start

# Linting
pnpm lint

# Type checking
pnpm tsc --noEmit --skipLibCheck
```

### Service Management
The application requires external services. Use the admin interface at `/admin` to:
- Configure service URLs
- Test connectivity to Qdrant and Ollama
- Pull the required `nomic-embed-text` model if missing

## Configuration

### Service Configuration
Configuration is managed via `config.json` in the project root:
```json
{
  "qdrantUrl": "http://localhost:6333",
  "ollamaUrl": "http://localhost:11434"
}
```

The config system in `lib/config.ts` provides:
- Automatic config file creation with defaults
- Type-safe config validation
- Runtime config updates via admin API

### Vector Collection Setup
- Collection name: `ideamem_memory`
- Embedding dimensions: 768 (for `nomic-embed-text`)
- Distance metric: Cosine similarity
- Auto-created on first use

## MCP Protocol Implementation

### JSON-RPC 2.0 Compliance
The API fully implements the Model Context Protocol specification built on JSON-RPC 2.0:
- All requests must include `jsonrpc: "2.0"` and a unique `id`
- Responses include proper `jsonrpc`, `id`, and either `result` or `error`
- Error responses follow JSON-RPC error format with codes and messages

### Supported MCP Methods
- `initialize`: Protocol handshake and capability negotiation
- `tools/list`: Lists available memory operation tools
- `tools/call`: Executes memory tools with proper argument structure
- `notifications/initialized`: Initialization completion notification
- `shutdown`: Graceful shutdown request
- `exit`: Process termination request

### Available Tools (via tools/call)
- `memory.ingest`: Store and index content with intelligent semantic chunking and project isolation. Supports AST-based parsing for JavaScript/TypeScript code. Content can be stored in global scope (cross-project) or project-specific scope. Returns success status, vector count, and effective project_id.
- `memory.retrieve`: Semantic search with project-aware filtering. Can search global scope only, project-specific content, or both. Returns up to 5 most relevant chunks with metadata, similarity scores, and project information. Supports filtering by type, language, source, and project scope.
- `memory.delete_source`: Project-aware bulk deletion of content chunks from a specific source identifier. Deletes only from specified project scope to prevent cross-project data loss. Returns success status and effective project_id.
- `memory.list_projects`: Discover all project identifiers that have content stored in the memory system. Returns sorted list of unique project_id values. Use this to verify available projects before performing project-specific operations.

### Content Types
- `code`: Programming code (supports AST-based chunking for JS/TS)
- `documentation`: Technical documentation
- `conversation`: Chat/discussion content
- `user_preference`: User settings and preferences
- `rule`: Business rules and constraints

### API Endpoints
- `POST /api/mcp`: Main MCP protocol endpoint (JSON-RPC 2.0 compliant)
- `GET/POST /api/admin/config`: Configuration management
- `POST /api/admin/health`: Service health checks
- `POST /api/admin/pull-model`: Ollama model management

### Project Isolation System
The memory system supports two scopes for content isolation:
- **Global Scope** (`project_id: "global"`): Content accessible across all projects
- **Project Scope** (`project_id: "your-project-id"`): Content isolated to specific project

### Scope Behaviors
- **Ingest**: `scope: "global"` stores in global, `scope: "project"` requires project_id
- **Retrieve**: `scope: "global"` searches global only, `scope: "project"` searches project only, `scope: "all"` searches both
- **Delete**: `scope: "global"` deletes from global, `scope: "project"` deletes from project only

### Example MCP Usage

#### Project-Specific Content
```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "tools/call",
  "params": {
    "name": "memory.ingest",
    "arguments": {
      "content": "function hello() { console.log('world'); }",
      "source": "src/hello.js",
      "type": "code",
      "language": "javascript",
      "project_id": "my-project",
      "scope": "project"
    }
  }
}
```

#### Cross-Project Search
```json
{
  "jsonrpc": "2.0",
  "id": "req-124",
  "method": "tools/call",
  "params": {
    "name": "memory.retrieve",
    "arguments": {
      "query": "authentication patterns",
      "project_id": "my-project",
      "scope": "all",
      "filters": {
        "type": "code"
      }
    }
  }
}
```

## Code Conventions

### TypeScript Setup
- Strict mode enabled with comprehensive type checking
- Path aliases: `@/*` maps to project root
- JSX support with React 19 and Next.js 15

### Component Architecture
- Client components use `'use client'` directive
- Function components with TypeScript interfaces for props
- Inline styling for UI components (no CSS framework dependency)

### Error Handling
- Comprehensive error boundaries in MCP API
- Service health monitoring with typed status responses
- Graceful degradation for missing external services

## Memory System Internals

### Chunking Strategy
For JavaScript/TypeScript code:
1. Parse with Babel to create AST
2. Extract functions, classes, and variable declarations
3. Fallback to paragraph-based chunking if AST parsing fails

For other content types:
- Split on double newlines (`\n\n`)
- Preserve semantic boundaries

### Embedding Process
1. Generate embedding via Ollama's `/api/embeddings` endpoint
2. Store with UUID identifier and metadata payload
3. Support batch operations for multiple chunks

### Search and Retrieval
- Semantic similarity search using cosine distance
- Configurable result limits (default: 5)
- Optional metadata filtering (type, source, language)
- Returns similarity scores and full payloads

## Testing and Validation

### Service Dependencies
Before development, ensure external services are running:
1. Start Qdrant vector database
2. Start Ollama with `nomic-embed-text` model installed
3. Use `/admin` interface to verify connectivity

### Testing Interfaces
- `/test-mcp`: Interactive UI for testing memory operations
- Built-in health checks for all external dependencies
- Console logging for debugging MCP operations

## Development Notes

### External Service URLs
- Configuration supports both localhost and network URLs
- Default configuration expects services on localhost
- Admin interface allows runtime URL changes without restart

### Next.js App Router
- Uses App Router with route handlers for API endpoints
- Client components for interactive admin and test interfaces
- TypeScript throughout with strict type checking

### Vector Database Schema
Each vector point includes:
- `id`: UUID identifier
- `vector`: 768-dimensional embedding array
- `payload`: Original content plus metadata (source, type, language)