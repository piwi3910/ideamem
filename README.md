# IdeaMem: The Comprehensive Guide

This document provides a complete overview of the IdeaMem system, from high-level architecture to detailed API usage and deployment strategies.

## 🚀 Quick Start

### Prerequisites

1.  **Qdrant Vector Database**:
    ```bash
    docker run -p 6333:6333 qdrant/qdrant
    ```

2.  **Ollama with embedding model**:
    ```bash
    # Install Ollama
    curl -fsSL https://ollama.ai/install.sh | sh

    # Pull the embedding model
    ollama pull nomic-embed-text
    ```

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/ideamem.git
    cd ideamem
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Start the development server**:
    ```bash
    pnpm dev
    ```

4.  **Configure services**:
    *   Open http://localhost:3000/admin
    *   Verify Qdrant and Ollama connections
    *   Pull the `nomic-embed-text` model if needed

### Create Your First Project

1.  Go to http://localhost:3000/dashboard
2.  Click "New Project"
3.  Enter project details and Git repository URL
4.  Click "Create Project"
5.  Click "Index" to start code indexing
6.  Use "Connect" to get MCP connection commands

### Connect to Claude Code

```bash
claude mcp add --transport http ideamem-project-name http://localhost:3000/api/mcp --header "Authorization: Bearer YOUR_TOKEN" --header "X-Project-ID: PROJECT_ID"
```

## 🏗️ Architecture

### System Overview

IdeaMem is a semantic memory system built on the Model Context Protocol (MCP), designed to provide intelligent code indexing and search capabilities with project isolation and comprehensive management tools.

#### Core Principles

1.  **Project Isolation** - Complete separation of data and operations between projects
2.  **Real-time Operations** - Live updates for indexing progress and status
3.  **Type Safety** - Comprehensive TypeScript coverage with strict mode
4.  **Error Resilience** - Graceful handling of failures with proper user feedback
5.  **Scalable Design** - Architecture that supports growth in projects and data

#### Technology Stack

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

### Component Architecture

#### Frontend Layer

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

#### Backend Layer

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

### Data Flow

#### Project Creation Flow

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

#### Code Indexing Flow

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

#### Semantic Search Flow

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

### Storage Systems

#### File-Based Storage

The system uses JSON files for metadata storage:

```
data/
├── projects.json
├── indexing-jobs.json
└── config.json
```

#### Vector Storage

Vectors are stored in Qdrant with project-based isolation.

### Security Model

*   **Token-Based Authentication**: Unique tokens per project.
*   **Project Isolation**: Data separation between projects.
*   **Authorization**: Token validates project access.

## 📚 API Documentation

### MCP Workflow

**MANDATORY FIRST STEP**: `codebase.check_constraints`

**BEFORE ANY CODE WRITING**:
*   `codebase.validate_symbol`
*   `codebase.validate_enum_values`
*   `codebase.check_function_signature`

### MCP Tools Reference

#### Core Codebase Tools
*   `codebase.check_constraints`
*   `codebase.set_constraints`
*   `codebase.search`
*   `codebase.store`
*   `codebase.forget`

#### File Management Tools
*   `codebase.index_file`
*   `codebase.refresh_file`
*   `codebase.rebuild_all`
*   `codebase.sync_changes`
*   `codebase.cleanup_project`

#### Code Validation Tools
*   `codebase.validate_symbol`
*   `codebase.validate_enum_values`
*   `codebase.check_function_signature`
*   `codebase.check_interface_changes`
*   `codebase.find_usage_patterns`

#### Documentation Tools
*   `docs.list_repositories`
*   `docs.add_repository`
*   `docs.index_repository`
*   `docs.search`
*   `docs.hybrid_search`
*   `docs.search_suggestions`
*   `docs.relationship_graph`
*   `docs.find_related`
*   `docs.faceted_search`

### API Endpoints

*   `POST /api/mcp`: Main MCP protocol endpoint.
*   `GET/POST /api/projects`: List/Create projects.
*   And many more for admin, indexing, webhooks, etc.

### Middleware and Validation

The API uses a robust middleware system for CORS, rate limiting, security headers, compression, and validation with Zod.

## 🖥️ Web Interface

*   **/dashboard**: Project overview and management.
*   **/projects/[id]**: Detailed project information and controls.
*   **/admin**: Service configuration and health monitoring.
*   **/test-mcp**: Interactive MCP testing interface.

## ⚙️ Configuration

### Service Configuration

Managed via `config.json` or the admin interface.

```json
{
  "qdrantUrl": "http://localhost:6333",
  "ollamaUrl": "http://localhost:11434"
}
```

### Environment Variables

```bash
# Optional: Override default ports and URLs
PORT=3000
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434
DATA_DIR=./data

# Logging Configuration
LOG_LEVEL=debug
LOG_DIR=./logs
SERVICE_NAME=ideamem-api
SERVICE_VERSION=1.0.0
HOSTNAME=localhost
NODE_ENV=development
```

## 🔧 Development

### Tech Stack

*   **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v3
*   **Backend**: Next.js API Routes, Node.js
*   **Database**: Qdrant (vectors), JSON files (metadata)
*   **AI/ML**: Ollama (`nomic-embed-text`)

### Development Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm tsc --noEmit --skipLibCheck
pnpm build
pnpm start
```

## 🚀 Deployment

Refer to the detailed [Deployment Guide](#-deployment-guide) section for production, Docker, and cloud deployment strategies.

## 🪵 Logging

IdeaMem uses Winston for structured logging. See the [Winston Logging Guide](#-winston-logging-guide) for details on configuration and usage.

## 🔌 Shutdown Manager

A centralized shutdown manager (`lib/shutdown-manager.ts`) handles graceful shutdown of services, preventing memory leaks and ensuring proper shutdown order.

## 🔄 Refactoring and Sprint Summaries

This project has undergone significant refactoring to improve code quality, reduce duplication, and implement unified patterns. Detailed summaries of these efforts are available in `REFACTORING_SUMMARY.md` and `SPRINT_3_SUMMARY.md`.

## 🔍 Troubleshooting

*   **Indexing Stuck**: Check the browser console for errors.
*   **MCP Connection Fails**: Verify token and headers.
*   **Qdrant/Ollama Issues**: Use the admin panel to check service health.

---

This guide provides a high-level overview. For more details, please refer to the specific documentation files that were consolidated to create this guide.
