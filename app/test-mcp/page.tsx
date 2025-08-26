'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CommandLineIcon,
  PlayIcon,
  ListBulletIcon,
  FolderIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Import React Query hooks
import { useMcpToolCall, useListMcpTools } from '@/hooks/use-mcp';

const defaultIngestParams = {
  content: `export interface User {\n  id: string;\n  email: string;\n  name: string;\n}\n\nexport function validateUser(user: User): boolean {\n  return user.email.includes('@') && user.name.length > 0;\n}\n\nexport async function createUser(userData: Omit<User, 'id'>): Promise<User> {\n  const user = {\n    id: crypto.randomUUID(),\n    ...userData\n  };\n  \n  if (!validateUser(user)) {\n    throw new Error('Invalid user data');\n  }\n  \n  return user;\n}`,
  source: 'src/models/User.ts',
  type: 'code',
  language: 'typescript',
  project_id: 'my-awesome-project',
  scope: 'project',
};

const defaultRetrieveParams = {
  query: 'how to create and validate users',
  filters: {
    type: 'code',
    language: 'typescript',
  },
  project_id: 'my-awesome-project',
  scope: 'all',
};

export default function McpTestPage() {
  // React Query hooks
  const toolCallMutation = useMcpToolCall();
  const listToolsMutation = useListMcpTools();

  // Local state for form inputs
  const [ingestParams, setIngestParams] = useState(JSON.stringify(defaultIngestParams, null, 2));
  const [retrieveParams, setRetrieveParams] = useState(
    JSON.stringify(defaultRetrieveParams, null, 2)
  );
  const [deleteParams, setDeleteParams] = useState(
    JSON.stringify(
      { source: 'src/models/User.ts', project_id: 'my-awesome-project', scope: 'project' },
      null,
      2
    )
  );
  const [response, setResponse] = useState('');

  // Derive loading state from mutations
  const isLoading = toolCallMutation.isPending || listToolsMutation.isPending;

  const handleSubmit = (toolName: string, params: string) => {
    setResponse('');
    
    try {
      const parsedParams = JSON.parse(params);
      toolCallMutation.mutate(
        { name: toolName, arguments: parsedParams },
        {
          onSuccess: (data) => {
            setResponse(JSON.stringify(data, null, 2));
          },
          onError: (error) => {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            setResponse(JSON.stringify({ error: errorMessage }, null, 2));
          },
        }
      );
    } catch (parseError) {
      setResponse(JSON.stringify({ error: 'Invalid JSON in parameters' }, null, 2));
    }
  };

  const handleListTools = () => {
    setResponse('');
    
    listToolsMutation.mutate(undefined, {
      onSuccess: (data) => {
        setResponse(JSON.stringify(data, null, 2));
      },
      onError: (error) => {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setResponse(JSON.stringify({ error: errorMessage }, null, 2));
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MCP Protocol Testing</h1>
          <p className="text-gray-600 mt-1">
            Test and debug Model Context Protocol operations
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Protocol Operations */}
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <CommandLineIcon className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Protocol Operations</h2>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleListTools}
                  disabled={isLoading}
                  className="btn btn-secondary w-full justify-center flex items-center gap-2"
                >
                  <ListBulletIcon className="h-4 w-4" />
                  {isLoading ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    'List Available Tools'
                  )}
                </button>

                <button
                  onClick={() => handleSubmit('memory.list_projects', '{}')}
                  disabled={isLoading}
                  className="btn btn-secondary w-full justify-center flex items-center gap-2"
                >
                  <FolderIcon className="h-4 w-4" />
                  {isLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 'List Projects'}
                </button>
              </div>
            </div>

            {/* Memory Ingest */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DocumentDuplicateIcon className="h-5 w-5" />
                Memory Ingest
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Tool Arguments (JSON)</label>
                  <textarea
                    value={ingestParams}
                    onChange={(e) => setIngestParams(e.target.value)}
                    rows={12}
                    className="input font-mono text-sm resize-y"
                    placeholder="Enter JSON arguments..."
                  />
                </div>
                <button
                  onClick={() => handleSubmit('memory.ingest', ingestParams)}
                  disabled={isLoading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isLoading ? 'Executing...' : 'Call memory.ingest'}
                </button>
              </div>
            </div>

            {/* Memory Retrieve */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Retrieve</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Tool Arguments (JSON)</label>
                  <textarea
                    value={retrieveParams}
                    onChange={(e) => setRetrieveParams(e.target.value)}
                    rows={8}
                    className="input font-mono text-sm resize-y"
                    placeholder="Enter JSON arguments..."
                  />
                </div>
                <button
                  onClick={() => handleSubmit('memory.retrieve', retrieveParams)}
                  disabled={isLoading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isLoading ? 'Executing...' : 'Call memory.retrieve'}
                </button>
              </div>
            </div>

            {/* Memory Delete Source */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Delete Source</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Tool Arguments (JSON)</label>
                  <textarea
                    value={deleteParams}
                    onChange={(e) => setDeleteParams(e.target.value)}
                    rows={4}
                    className="input font-mono text-sm resize-y"
                    placeholder="Enter JSON arguments..."
                  />
                </div>
                <button
                  onClick={() => handleSubmit('memory.delete_source', deleteParams)}
                  disabled={isLoading}
                  className="btn btn-danger w-full flex items-center justify-center gap-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  {isLoading ? 'Executing...' : 'Call memory.delete_source'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Response */}
          <div className="space-y-6">
            <div className="card h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Response</h3>
                {response && (
                  <button
                    onClick={() => copyToClipboard(response)}
                    className="btn btn-secondary btn-sm"
                  >
                    Copy Response
                  </button>
                )}
              </div>

              <div className="relative">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                  {response || 'No response yet. Execute a tool to see the result.'}
                </pre>

                {isLoading && (
                  <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-white">
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      <span>Executing...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Response Info */}
              {response && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                  <p>
                    <strong>Protocol:</strong> JSON-RPC 2.0 over HTTP
                  </p>
                  <p>
                    <strong>Content-Type:</strong> application/json
                  </p>
                  <p>
                    <strong>Method:</strong> POST /api/mcp
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documentation */}
        <div className="mt-12 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">MCP Protocol Documentation</h3>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-600 mb-4">
              This interface allows you to test the Model Context Protocol (MCP) implementation. All
              requests follow the JSON-RPC 2.0 specification with proper error handling.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Available Tools</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>
                    <code>memory.ingest</code> - Store content with semantic chunking
                  </li>
                  <li>
                    <code>memory.retrieve</code> - Search indexed content
                  </li>
                  <li>
                    <code>memory.delete_source</code> - Remove content by source
                  </li>
                  <li>
                    <code>memory.list_projects</code> - List all projects
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Project Scopes</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>
                    <code>global</code> - Accessible across all projects
                  </li>
                  <li>
                    <code>project</code> - Isolated to specific project
                  </li>
                  <li>
                    <code>all</code> - Search both scopes (retrieve only)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
