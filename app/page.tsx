'use client';

import Link from 'next/link';
import { 
  CpuChipIcon, 
  CommandLineIcon, 
  ChartBarIcon,
  ServerIcon,
  Cog6ToothIcon,
  FolderIcon
} from '@heroicons/react/24/outline';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <CpuChipIcon className="h-8 w-8 text-primary-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">IdeaMem</h1>
              <span className="ml-2 px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
                Semantic Memory System
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Intelligent Code Memory
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Index, search, and retrieve your codebase using AI-powered semantic search.
            Built on vector embeddings for intelligent code understanding.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <Link href="/dashboard" className="card hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <FolderIcon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900">Projects</h3>
            </div>
            <p className="text-gray-600">
              Manage your projects, add repositories, and control indexing with project-scoped isolation.
            </p>
          </Link>

          <Link href="/admin" className="card hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Cog6ToothIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900">Configuration</h3>
            </div>
            <p className="text-gray-600">
              Configure Qdrant and Ollama services, test connections, and manage system settings.
            </p>
          </Link>

          <Link href="/test-mcp" className="card hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CommandLineIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="ml-4 text-lg font-semibold text-gray-900">MCP Testing</h3>
            </div>
            <p className="text-gray-600">
              Test MCP protocol operations, debug tool calls, and validate memory operations.
            </p>
          </Link>
        </div>

        {/* Stats Section */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">System Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-3">
                <ServerIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="text-sm font-medium text-gray-900">Vector Database</h4>
              <p className="text-xs text-gray-500 mt-1">Qdrant for semantic search</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-3">
                <CpuChipIcon className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="text-sm font-medium text-gray-900">AI Embeddings</h4>
              <p className="text-xs text-gray-500 mt-1">Ollama with nomic-embed-text</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mx-auto mb-3">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="text-sm font-medium text-gray-900">MCP Protocol</h4>
              <p className="text-xs text-gray-500 mt-1">JSON-RPC 2.0 compliant</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="btn btn-primary">
              Manage Projects
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              System Configuration
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>IdeaMem - Semantic Memory System</p>
            <p className="mt-1">Built with Next.js, Qdrant, and Ollama</p>
          </div>
        </div>
      </footer>
    </div>
  );
}