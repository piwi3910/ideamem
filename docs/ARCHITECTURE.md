# IdeaMem Architecture Documentation

This document provides a detailed technical overview of the IdeaMem system architecture, design decisions, and implementation details.

## Table of Contents

- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Storage Systems](#storage-systems)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)
- [Scalability Design](#scalability-design)
- [Error Handling](#error-handling)
- [Monitoring and Observability](#monitoring-and-observability)

## System Overview

IdeaMem is a semantic memory system built on the Model Context Protocol (MCP), designed to provide intelligent code indexing and search capabilities with project isolation and comprehensive management tools.

### Core Principles

1. **Project Isolation** - Complete separation of data and operations between projects
2. **Real-time Operations** - Live updates for indexing progress and status
3. **Type Safety** - Comprehensive TypeScript coverage with strict mode
4. **Error Resilience** - Graceful handling of failures with proper user feedback
5. **Scalable Design** - Architecture that supports growth in projects and data

### Technology Stack

```mermaid
graph TB
    subgraph "Frontend"
        React[React 19]
        Next[Next.js 15]
        TS[TypeScript]
        TW[Tailwind CSS v3]
        HUI[Headless UI]
    end

    subgraph "Backend"
        API[Next.js API Routes]
        Node[Node.js Runtime]
        FS[File System Storage]
    end

    subgraph "External Services"
        Qdrant[Qdrant Vector DB]
        Ollama[Ollama LLM]
        Git[Git Repositories]
    end

    subgraph "Protocols"
        MCP[Model Context Protocol]
        JSONRPC[JSON-RPC 2.0]
        HTTP[HTTP/HTTPS]
    end

    React --> Next
    Next --> API
    API --> Qdrant
    API --> Ollama
    API --> Git
    API --> MCP
    MCP --> JSONRPC
```

## Component Architecture

### Frontend Layer

The frontend is built as a single-page application with multiple views:

```mermaid
graph LR
    subgraph "Pages"
        Home[Landing Page]
        Dashboard[Project Dashboard]
        Details[Project Details]
        Admin[Admin Panel]
        Test[MCP Test Interface]
    end

    subgraph "Components"
        Modal[Modal Dialogs]
        Cards[Project Cards]
        Forms[Input Forms]
        Progress[Progress Bars]
        Metrics[Metric Displays]
    end

    subgraph "Hooks"
        State[State Management]
        Polling[Real-time Polling]
        API[API Integration]
    end

    Dashboard --> Cards
    Details --> Metrics
    Details --> Modal
    Admin --> Forms
    Test --> API

    Cards --> State
    Progress --> Polling
    Modal --> API
```

#### Key Components

1. **Project Dashboard** (`/dashboard`)
   - Grid-based project overview
   - Real-time status indicators
   - Quick action buttons
   - Create project modal

2. **Project Details** (`/projects/[id]`)
   - Comprehensive project information
   - Token management interface
   - MCP connection setup
   - Query metrics visualization
   - Indexing control panel

3. **Admin Panel** (`/admin`)
   - Service configuration management
   - Health monitoring dashboard
   - Model management interface

### Backend Layer

The backend is structured around Next.js API routes with clear separation of concerns:

```mermaid
graph TB
    subgraph "API Routes"
        MCP_API["/api/mcp"]
        Projects["/api/projects/*"]
        Admin["/api/admin/*"]
        Indexing["/api/projects/indexing/status"]
    end

    subgraph "Business Logic"
        ProjectManager["lib/projects.ts"]
        MemorySystem["lib/memory.ts"]
        IndexingEngine["lib/indexing.ts"]
        ConfigManager["lib/config.ts"]
    end

    subgraph "External Integrations"
        QdrantAPI["Qdrant HTTP API"]
        OllamaAPI["Ollama REST API"]
        GitCLI["Git Command Line"]
    end

    MCP_API --> MemorySystem
    Projects --> ProjectManager
    Admin --> ConfigManager
    Indexing --> IndexingEngine

    MemorySystem --> QdrantAPI
    MemorySystem --> OllamaAPI
    IndexingEngine --> GitCLI
    ProjectManager --> QdrantAPI
```

#### Key Modules

1. **MCP Protocol Handler** (`app/api/mcp/route.ts`)
   - JSON-RPC 2.0 compliance
   - Authentication and authorization
   - Tool discovery and execution
   - Error handling and responses

2. **Project Management** (`lib/projects.ts`)
   - CRUD operations for projects
   - Token generation and validation
   - Query metrics tracking
   - Indexing job management

3. **Memory System** (`lib/memory.ts`)
   - Vector embedding operations
   - Semantic search capabilities
   - Content chunking and parsing
   - Qdrant integration

4. **Indexing Engine** (`lib/indexing.ts`)
   - Git repository cloning
   - File system traversal
   - AST-based code parsing
   - Background job processing

## Data Flow

### Project Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web UI
    participant A as API
    participant P as Project Manager
    participant F as File System

    U->>W: Create Project Form
    W->>A: POST /api/projects
    A->>P: createProject()
    P->>P: Generate UUID & Token
    P->>F: Write projects.json
    F-->>P: Confirm Write
    P-->>A: Project Created
    A-->>W: Project Data
    W-->>U: Success Message
```

### Code Indexing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web UI
    participant A as API
    participant I as Indexing Engine
    participant G as Git CLI
    participant M as Memory System
    participant O as Ollama
    participant Q as Qdrant

    U->>W: Click "Index"
    W->>A: POST /projects/{id}/index
    A->>I: startCodebaseIndexing()
    I->>G: git clone
    G-->>I: Repository Files

    loop For Each File
        I->>I: Parse & Chunk Content
        I->>M: ingest()
        M->>O: Generate Embedding
        O-->>M: Vector Embedding
        M->>Q: Store Vector
        Q-->>M: Confirm Storage
        I->>A: Update Progress
        A->>W: Progress Update
        W-->>U: Progress Bar
    end

    I-->>A: Indexing Complete
    A-->>W: Status Update
    W-->>U: Success Indicator
```

### Semantic Search Flow

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant A as MCP API
    participant M as Memory System
    participant O as Ollama
    participant Q as Qdrant
    participant P as Project Manager

    C->>A: memory.retrieve(query)
    A->>P: trackQuery() [async]
    A->>M: retrieve()
    M->>O: Generate Query Embedding
    O-->>M: Query Vector
    M->>Q: Similarity Search
    Q-->>M: Matching Vectors
    M->>M: Rank & Filter Results
    M-->>A: Search Results
    A-->>C: Formatted Response
```

## Storage Systems

### File-Based Storage

The system uses JSON files for metadata storage, providing simplicity and transparency:

```
data/
├── projects.json          # Project metadata and configuration
├── indexing-jobs.json     # Background job tracking
└── config.json           # Service configuration
```

#### Project Data Structure

```typescript
interface Project {
  id: string; // UUID
  name: string; // Display name
  description?: string; // Optional description
  gitRepo: string; // Repository URL
  token: string; // Authentication token (idm_*)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  indexedAt?: string; // Last successful index
  indexStatus: Status; // Current indexing state
  indexProgress?: number; // 0-100 completion
  fileCount?: number; // Indexed files count
  vectorCount?: number; // Vector embeddings count
  lastError?: string; // Last error message

  // Query metrics
  totalQueries?: number; // Lifetime query count
  lastQueryAt?: string; // Most recent query
  queriesThisWeek?: number; // 7-day rolling count
  queriesThisMonth?: number; // 30-day rolling count
}
```

#### Indexing Job Structure

```typescript
interface IndexingJob {
  projectId: string; // Project reference
  status: JobStatus; // Current job state
  progress: number; // 0-100 completion
  currentFile?: string; // Currently processing file
  totalFiles: number; // Total files to process
  processedFiles: number; // Files completed
  vectorCount?: number; // Vectors created
  startTime: string; // Job start timestamp
  endTime?: string; // Job completion timestamp
  error?: string; // Error message if failed
}
```

### Vector Storage

Vectors are stored in Qdrant with project-based isolation:

```typescript
interface VectorPayload {
  content: string; // Original text content
  source: string; // File path or identifier
  type: ContentType; // Content classification
  language: string; // Programming language
  project_id: string; // Project isolation
  scope: 'project' | 'global'; // Access scope
  chunk_index?: number; // Chunk sequence number
  metadata?: Record<string, any>; // Additional metadata
}
```

## Security Model

### Authentication

1. **Token-Based Authentication**
   - Each project has a unique token (`idm_` prefix)
   - Tokens are cryptographically secure UUIDs
   - Bearer token authentication for MCP clients

2. **Project Isolation**
   - Complete data separation between projects
   - Vector queries filtered by project_id
   - No cross-project data leakage

3. **Authorization**
   - Token validates project access
   - Project ID header ensures proper isolation
   - Admin operations require local access

### Data Protection

```mermaid
graph TB
    subgraph "Security Layers"
        Auth[Token Authentication]
        Iso[Project Isolation]
        Valid[Input Validation]
        Enc[Data Encoding]
    end

    subgraph "Threat Mitigation"
        XSS[XSS Protection]
        CSRF[CSRF Prevention]
        Inject[Injection Prevention]
        Access[Access Control]
    end

    Auth --> Iso
    Iso --> Valid
    Valid --> Enc

    Auth --> Access
    Valid --> Inject
    Enc --> XSS
    Iso --> CSRF
```

## Performance Considerations

### Indexing Performance

1. **Chunking Strategy**
   - AST-based parsing for code files
   - Semantic boundary detection
   - Optimal chunk size for embeddings

2. **Background Processing**
   - Non-blocking indexing operations
   - Progress tracking and cancellation
   - Resource management

3. **Vector Operations**
   - Batch embedding generation
   - Efficient similarity search
   - Result ranking and filtering

### Query Performance

1. **Embedding Cache**
   - Query embedding reuse
   - Common query optimization
   - Response caching strategies

2. **Search Optimization**
   - Project-scoped searches
   - Filter-first approach
   - Similarity threshold tuning

### Frontend Performance

1. **Real-time Updates**
   - Efficient polling strategies
   - Conditional rendering
   - State synchronization

2. **UI Responsiveness**
   - Progressive loading
   - Optimistic updates
   - Error boundaries

## Scalability Design

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[Load Balancer]
    end

    subgraph "App Instances"
        App1[IdeaMem Instance 1]
        App2[IdeaMem Instance 2]
        App3[IdeaMem Instance N]
    end

    subgraph "Shared Services"
        Qdrant[Qdrant Cluster]
        Ollama[Ollama Pool]
        Storage[Shared Storage]
    end

    LB --> App1
    LB --> App2
    LB --> App3

    App1 --> Qdrant
    App2 --> Qdrant
    App3 --> Qdrant

    App1 --> Ollama
    App2 --> Ollama
    App3 --> Ollama

    App1 --> Storage
    App2 --> Storage
    App3 --> Storage
```

### Vertical Scaling

1. **Resource Allocation**
   - Memory for vector operations
   - CPU for embedding generation
   - Storage for vector data

2. **Optimization Points**
   - Qdrant configuration tuning
   - Ollama model optimization
   - Node.js runtime tuning

## Error Handling

### Error Categories

1. **System Errors**
   - Service unavailable
   - Network connectivity
   - Resource exhaustion

2. **User Errors**
   - Invalid input
   - Authentication failures
   - Permission denied

3. **Business Logic Errors**
   - Project not found
   - Indexing conflicts
   - Query failures

### Error Response Format

```typescript
interface ErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number; // JSON-RPC error code
    message: string; // Human-readable message
    data?: any; // Additional error context
  };
  id: string | number | null; // Request ID
}
```

### Recovery Strategies

```mermaid
graph TB
    Error[Error Detected]

    Error --> Retry{Retryable?}
    Retry -->|Yes| Wait[Exponential Backoff]
    Wait --> Attempt[Retry Operation]
    Attempt --> Success[Success]
    Attempt --> Retry

    Retry -->|No| Fallback{Fallback Available?}
    Fallback -->|Yes| Degrade[Graceful Degradation]
    Fallback -->|No| Report[Report Error to User]

    Degrade --> Partial[Partial Functionality]
    Report --> UserAction[User Intervention Required]
```

## Monitoring and Observability

### Metrics Collection

1. **System Metrics**
   - Request latency
   - Error rates
   - Resource utilization

2. **Business Metrics**
   - Project creation rate
   - Indexing success rate
   - Query volume and performance

3. **User Metrics**
   - Active projects
   - Query patterns
   - Feature usage

### Logging Strategy

```typescript
interface LogEntry {
  timestamp: string; // ISO timestamp
  level: LogLevel; // ERROR, WARN, INFO, DEBUG
  component: string; // System component
  message: string; // Log message
  context?: Record<string, any>; // Additional context
  requestId?: string; // Request correlation
  userId?: string; // User context
  projectId?: string; // Project context
}
```

### Health Checks

1. **Service Health**
   - Qdrant connectivity
   - Ollama model availability
   - File system access

2. **Application Health**
   - API responsiveness
   - Background job status
   - Memory usage

3. **End-to-End Health**
   - Complete indexing workflow
   - Full query pipeline
   - User interface functionality

---

This architecture provides a solid foundation for a scalable, maintainable semantic memory system while maintaining simplicity and transparency in its design and implementation.
