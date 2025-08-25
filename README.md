# IdeaMem - Semantic Memory MCP Server

A professional Model Context Protocol (MCP) server for semantic memory operations with intelligent code indexing, project isolation, and a modern web interface.

## 🚀 Features

### Core Functionality

- **Semantic Code Search** - AST-based chunking for JavaScript/TypeScript with intelligent parsing
- **Multi-format Support** - Code, documentation, configuration files, and more
- **Project Isolation** - Separate semantic memory spaces per project with token-based authentication
- **Background Indexing** - Git repository cloning with real-time progress tracking
- **Query Metrics** - Track and visualize MCP usage statistics
- **Professional Web UI** - Modern React dashboard with comprehensive project management

### MCP Protocol

- **JSON-RPC 2.0 Compliant** - Full MCP protocol implementation
- **Tool Discovery** - Automatic tool listing and capability negotiation
- **Error Handling** - Comprehensive error boundaries with proper status codes
- **Authentication** - Token-based per-project security

### Architecture

- **Vector Database** - Qdrant integration for semantic embeddings
- **Local LLM** - Ollama with `nomic-embed-text` model for embeddings
- **Project Management** - Multi-tenant isolation with comprehensive metrics
- **Real-time Updates** - Live indexing progress and status synchronization
- **Webhook Integration** - Automatic re-indexing on Git push events from GitHub, GitLab, and Bitbucket

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [API Documentation](#-api-documentation)
- [Web Interface](#-web-interface)
- [Configuration](#-configuration)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

## 🎯 Quick Start

### Prerequisites

1. **Qdrant Vector Database**

   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```

2. **Ollama with embedding model**

   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh

   # Pull the embedding model
   ollama pull nomic-embed-text
   ```

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/ideamem.git
   cd ideamem
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

4. **Configure services**
   - Open http://localhost:3000/admin
   - Verify Qdrant and Ollama connections
   - Pull the `nomic-embed-text` model if needed

### Create Your First Project

1. Go to http://localhost:3000/dashboard
2. Click "New Project"
3. Enter project details and Git repository URL
4. Click "Create Project"
5. Click "Index" to start code indexing
6. Use "Connect" to get MCP connection commands

### Connect to Claude Code

```bash
claude mcp add --transport http ideamem-project-name http://localhost:3000/api/mcp --header "Authorization: Bearer YOUR_TOKEN" --header "X-Project-ID: PROJECT_ID"
```

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph "MCP Clients"
        CC[Claude Code]
        GM[Gemini]
        OC[Other Clients]
    end

    subgraph "IdeaMem Server"
        WEB[Web Interface]
        API[MCP API Server]
        PM[Project Manager]
        IM[Indexing Manager]
        MM[Memory Manager]
    end

    subgraph "External Services"
        QD[Qdrant Vector DB]
        OL[Ollama LLM]
        GR[Git Repositories]
    end

    subgraph "Data Storage"
        PF[Projects JSON]
        JF[Jobs JSON]
        CF[Config JSON]
    end

    CC --> API
    GM --> API
    OC --> API

    WEB --> PM
    API --> MM
    PM --> IM
    IM --> GR
    MM --> QD
    MM --> OL

    PM --> PF
    IM --> JF
    WEB --> CF

    style API fill:#e1f5fe
    style MM fill:#f3e5f5
    style QD fill:#fff3e0
    style OL fill:#e8f5e8
```

### Component Architecture

```mermaid
graph LR
    subgraph "Frontend Layer"
        D[Dashboard]
        PD[Project Details]
        A[Admin Panel]
        T[Test Interface]
    end

    subgraph "API Layer"
        MCP[MCP Protocol Handler]
        PR[Project Routes]
        AR[Admin Routes]
        IR[Indexing Routes]
    end

    subgraph "Business Logic"
        PM[Project Manager]
        IM[Indexing Engine]
        MM[Memory System]
        QM[Query Metrics]
    end

    subgraph "Data Layer"
        FS[File System Storage]
        VDB[Vector Database]
        LLM[Local LLM Service]
    end

    D --> PR
    PD --> PR
    A --> AR
    T --> MCP

    MCP --> MM
    PR --> PM
    AR --> PM
    IR --> IM

    PM --> FS
    IM --> VDB
    MM --> VDB
    MM --> LLM
    QM --> FS

    style MCP fill:#ffeb3b,color:#000
    style MM fill:#4caf50,color:#fff
    style VDB fill:#ff9800,color:#fff
```

### Data Flow

```mermaid
sequenceDiagram
    participant C as MCP Client
    participant A as MCP API
    participant M as Memory System
    participant Q as Qdrant DB
    participant O as Ollama
    participant P as Project Manager

    Note over C,P: Project Setup
    C->>A: Create Project
    A->>P: Store Project + Generate Token
    P-->>A: Project Created
    A-->>C: Token & Project ID

    Note over C,P: Code Indexing
    C->>A: Start Indexing
    A->>P: Clone Git Repository
    P->>M: Process Files (AST Parsing)
    M->>O: Generate Embeddings
    O-->>M: Vector Embeddings
    M->>Q: Store Vectors + Metadata
    Q-->>M: Storage Confirmed
    M-->>P: Files Processed
    P-->>A: Indexing Complete

    Note over C,P: Semantic Search
    C->>A: memory.retrieve(query)
    A->>P: Track Query Metrics
    A->>M: Semantic Search
    M->>O: Generate Query Embedding
    O-->>M: Query Vector
    M->>Q: Vector Similarity Search
    Q-->>M: Similar Chunks
    M-->>A: Ranked Results
    A-->>C: Search Results
```

### File Structure

```
ideamem/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin panel
│   ├── api/                      # API routes
│   │   ├── admin/               # Admin endpoints
│   │   ├── mcp/                 # MCP protocol handler
│   │   └── projects/            # Project management
│   ├── dashboard/               # Main dashboard
│   ├── projects/[id]/          # Project detail pages
│   └── test-mcp/               # MCP testing interface
├── lib/                         # Business logic
│   ├── config.ts               # Configuration management
│   ├── indexing.ts             # Background indexing
│   ├── memory.ts               # Semantic memory operations
│   └── projects.ts             # Project management
├── data/                        # Runtime data (gitignored)
│   ├── projects.json           # Project storage
│   ├── indexing-jobs.json      # Job tracking
│   └── config.json             # Service configuration
└── docs/                        # Documentation
    └── architecture.md          # Detailed architecture docs
```

## 📚 API Documentation

### MCP Protocol Endpoints

#### POST /api/mcp

The main MCP protocol endpoint supporting JSON-RPC 2.0.

**Headers:**

- `Authorization: Bearer <token>` - Project authentication token
- `X-Project-ID: <project-id>` - Project identifier
- `Content-Type: application/json`

**Supported Methods:**

##### `initialize`

Initialize MCP connection and negotiate capabilities.

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05"
  },
  "id": 1
}
```

##### `tools/list`

List available memory tools.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

##### `tools/call` - memory.ingest

Store and index content in semantic memory.

```json
{
  "jsonrpc": "2.0",
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
  },
  "id": 3
}
```

##### `tools/call` - memory.retrieve

Perform semantic search across indexed content.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "memory.retrieve",
    "arguments": {
      "query": "authentication functions",
      "project_id": "my-project",
      "scope": "project",
      "filters": {
        "type": "code",
        "language": "typescript"
      }
    }
  },
  "id": 4
}
```

##### `tools/call` - memory.delete_source

Delete all content from a specific source.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "memory.delete_source",
    "arguments": {
      "source": "src/old-file.js",
      "project_id": "my-project",
      "scope": "project"
    }
  },
  "id": 5
}
```

##### `tools/call` - memory.list_projects

List all available project identifiers.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "memory.list_projects",
    "arguments": {}
  },
  "id": 6
}
```

##### `tools/call` - indexing.index_file

Index a single file in a project repository before git push operations.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "indexing.index_file",
    "arguments": {
      "project_id": "my-project",
      "file_path": "src/components/Button.tsx",
      "branch": "main"
    }
  },
  "id": 7
}
```

##### `tools/call` - indexing.reindex_file

Reindex an existing file, removing old vectors and creating new ones.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "indexing.reindex_file",
    "arguments": {
      "project_id": "my-project",
      "file_path": "src/utils/helpers.js",
      "branch": "main"
    }
  },
  "id": 8
}
```

##### `tools/call` - indexing.full_reindex

Perform a complete reindex of an entire project repository.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "indexing.full_reindex",
    "arguments": {
      "project_id": "my-project",
      "branch": "main"
    }
  },
  "id": 9
}
```

##### `tools/call` - indexing.check_and_index

Check for new git commits and perform incremental indexing if changes are found.

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "indexing.check_and_index",
    "arguments": {
      "project_id": "my-project",
      "branch": "main"
    }
  },
  "id": 10
}
```

### Web API Endpoints

#### Projects

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `DELETE /api/projects/[id]` - Delete project
- `POST /api/projects/[id]/token` - Regenerate token
- `POST /api/projects/[id]/index` - Start indexing
- `DELETE /api/projects/[id]/index` - Stop indexing
- `GET /api/projects/[id]/webhook` - Get webhook configuration
- `POST /api/projects/[id]/webhook` - Enable/disable webhook

#### Admin

- `GET/POST /api/admin/config` - Service configuration
- `POST /api/admin/health` - Health checks
- `POST /api/admin/pull-model` - Pull Ollama models

#### Indexing

- `GET /api/projects/indexing/status` - Get active indexing jobs

#### Webhooks

- `POST /api/webhooks/[projectId]` - Receive Git platform webhooks for automatic re-indexing

#### Scheduled Indexing

- `GET /api/projects/[id]/schedule` - Get scheduled indexing configuration
- `POST /api/projects/[id]/schedule` - Configure scheduled indexing settings
- `POST /api/scheduler/run` - Manual scheduler execution for all projects
- `GET /api/scheduler/run` - Check projects needing scheduled indexing

## 🖥️ Web Interface

### Dashboard (`/dashboard`)

- **Project Overview** - Grid view of all projects with status indicators
- **Quick Actions** - Start/stop indexing, view details
- **Status Monitoring** - Real-time indexing progress with file counts
- **Project Creation** - Modal form for new project setup

### Project Details (`/projects/[id]`)

- **Comprehensive Information** - Git repo, creation dates, indexing history
- **Token Management** - View, copy, and regenerate authentication tokens
- **MCP Connection Setup** - Generate connection commands for Claude Code and Gemini
- **Query Metrics** - Visual statistics showing usage patterns
- **Indexing Control** - Start, stop, monitor background indexing
- **File Statistics** - Detailed counts of indexed files and vectors
- **Webhook Management** - Configure automatic re-indexing on Git push events
- **Scheduled Indexing** - Set up periodic incremental indexing with customizable intervals

### Admin Panel (`/admin`)

- **Service Configuration** - Qdrant and Ollama connection settings
- **Health Monitoring** - Service status and connectivity checks
- **Model Management** - Pull and verify Ollama embedding models
- **Scheduled Indexing Management** - Manual scheduler execution and automation setup
- **System Status** - Overall system health dashboard

### Test Interface (`/test-mcp`)

- **Protocol Testing** - Interactive MCP protocol validation
- **Tool Execution** - Test memory operations directly
- **Debug Interface** - Raw JSON-RPC request/response viewer

## ⚙️ Configuration

### Service Configuration

The system uses `config.json` for service configuration:

```json
{
  "qdrantUrl": "http://localhost:6333",
  "ollamaUrl": "http://localhost:11434"
}
```

Configuration can be updated via:

1. Admin web interface (`/admin`)
2. Direct API calls to `/api/admin/config`
3. Manual `config.json` editing (requires restart)

### Environment Variables

```bash
# Optional: Override default ports
PORT=3000
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434

# Optional: Data directory
DATA_DIR=./data
```

### Project Structure

Each project maintains:

- **Unique ID** - UUID-based project identifier
- **Authentication Token** - Secure access token (`idm_` prefixed)
- **Git Repository** - Source repository URL
- **Indexing Status** - Current processing state
- **Query Metrics** - Usage statistics and timestamps
- **Vector Storage** - Project-scoped semantic index

### Scheduled Indexing Setup

Scheduled indexing provides automatic incremental indexing for environments where webhooks aren't available.

#### Configuration Options

**Per-Project Settings:**

- **Enable/Disable** - Toggle scheduled indexing for individual projects
- **Interval** - Choose from 5 minutes to 24 hours
- **Branch** - Specify which branch to monitor (default: main)
- **Next Run Time** - Automatically calculated based on interval

**Available Intervals:**

- Every 5 minutes
- Every 15 minutes
- Every 30 minutes
- Every hour
- Every 2 hours
- Every 6 hours
- Every 12 hours
- Every 24 hours

#### How It Works

1. **Commit Detection** - Checks current git commit vs last indexed commit
2. **Smart Processing** - Only runs incremental indexing if changes are detected
3. **Efficiency** - Skips processing if already up to date
4. **Fallback** - Performs full indexing for first-time projects

#### Automation Setup

**Option 1: Manual Execution (Admin Panel)**

- Use `/admin` interface to manually trigger scheduler
- Good for testing and occasional use

**Option 2: Cron Job (Recommended)**

```bash
# Add to crontab for every 5 minutes
*/5 * * * * curl -X POST http://your-domain.com/api/scheduler/run

# Add to crontab for every 15 minutes
*/15 * * * * curl -X POST http://your-domain.com/api/scheduler/run
```

**Option 3: Docker/Kubernetes CronJob**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ideamem-scheduler
spec:
  schedule: '*/10 * * * *' # Every 10 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: scheduler
              image: curlimages/curl
              command:
                - curl
                - -X
                - POST
                - http://ideamem-service/api/scheduler/run
          restartPolicy: OnFailure
```

**Option 4: GitHub Actions (for public repos)**

```yaml
name: IdeaMem Scheduler
on:
  schedule:
    - cron: '*/10 * * * *' # Every 10 minutes
  workflow_dispatch: # Manual trigger

jobs:
  trigger-indexing:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scheduler
        run: |
          curl -X POST ${{ secrets.IDEAMEM_URL }}/api/scheduler/run
```

#### Best Practices

- **Start Conservative** - Begin with longer intervals (30+ minutes) and adjust based on your needs
- **Monitor Performance** - Check admin panel for scheduler results and timing
- **Use Webhooks When Possible** - Webhooks provide immediate updates; use scheduling as backup
- **Consider Repository Size** - Larger repositories may need longer intervals
- **Network Reliability** - Ensure stable network connection for git operations

## 🔧 Development

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v3
- **Backend**: Next.js API Routes, Node.js
- **Database**: Qdrant (vectors), JSON files (metadata)
- **AI/ML**: Ollama (`nomic-embed-text`)
- **UI Components**: Headless UI, Heroicons
- **Build Tools**: pnpm, TypeScript compiler

### Development Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Type checking
pnpm tsc --noEmit --skipLibCheck

# Linting
pnpm lint

# Production build
pnpm build

# Production start
pnpm start
```

### Code Organization

- **Separation of Concerns** - Clear boundaries between UI, API, and business logic
- **Type Safety** - Comprehensive TypeScript coverage with strict mode
- **Error Handling** - Proper error boundaries and user feedback
- **Code Quality** - ESLint rules without disabled directives

### Testing Strategy

- **MCP Protocol** - Use `/test-mcp` interface for protocol validation
- **API Endpoints** - Manual testing via web interface
- **Indexing** - Monitor via dashboard with real-time progress
- **Memory Operations** - Test semantic search through MCP clients

## 🚀 Deployment

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Service Dependencies

Ensure these services are running:

1. **Qdrant Vector Database**

   ```bash
   docker run -d -p 6333:6333 qdrant/qdrant
   ```

2. **Ollama with Models**
   ```bash
   ollama serve
   ollama pull nomic-embed-text
   ```

### Production Checklist

- [ ] Configure service URLs for production
- [ ] Set up proper authentication/authorization
- [ ] Configure persistent data storage
- [ ] Set up monitoring and logging
- [ ] Configure backup procedures
- [ ] Test MCP client connections
- [ ] Verify indexing performance
- [ ] Monitor query metrics

## 🔍 Troubleshooting

### Common Issues

#### Indexing Stuck in Progress

- **Symptom**: Status shows "Indexing" but progress bar disappears
- **Solution**: Fixed in latest version with smart status detection
- **Verification**: Check browser console for "Refreshing projects" logs

#### MCP Connection Fails

- **Symptom**: Claude Code reports connection errors
- **Solution**: Verify token format and headers
- **Command**: Use exact format from Connection Setup modal

#### Qdrant Connection Issues

- **Symptom**: "Failed to connect to Qdrant" in admin panel
- **Solution**: Verify Qdrant is running on correct port
- **Check**: `curl http://localhost:6333/collections`

#### Ollama Model Missing

- **Symptom**: "Model not found" errors during indexing
- **Solution**: Pull the embedding model
- **Command**: `ollama pull nomic-embed-text`

### Debug Tools

1. **Browser Console** - Check for client-side errors
2. **Network Tab** - Monitor API requests and responses
3. **Admin Panel** - Service health and connectivity
4. **Test Interface** - MCP protocol validation

### Performance Tips

- **Large Repositories**: Consider selective indexing
- **Query Performance**: Use specific filters for better results
- **Memory Usage**: Monitor Qdrant collection size
- **Network**: Ensure low latency to Qdrant and Ollama

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/ideamem/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/ideamem/discussions)
- **Documentation**: [Wiki](https://github.com/your-username/ideamem/wiki)

---

Built with ❤️ using [Claude Code](https://claude.ai/code)
