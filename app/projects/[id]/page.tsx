'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Dialog } from '@headlessui/react';
import {
  ArrowLeftIcon,
  FolderIcon,
  TrashIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XMarkIcon,
  LinkIcon,
  CommandLineIcon,
  ClipboardDocumentIcon,
  CalendarIcon,
  CodeBracketIcon,
  ServerIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  BoltIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import ProjectRulesManager from '@/components/ProjectRulesManager';
import ProjectPreferencesManager from '@/components/ProjectPreferencesManager';

interface Project {
  id: string;
  name: string;
  description?: string;
  gitRepo: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  indexedAt?: string;
  indexStatus: 'IDLE' | 'INDEXING' | 'COMPLETED' | 'ERROR';
  indexProgress?: number;
  fileCount?: number;
  vectorCount?: number;
  lastError?: string;
  // Query metrics
  totalQueries?: number;
  lastQueryAt?: string;
  queriesThisWeek?: number;
  queriesThisMonth?: number;
  // Webhook information
  webhookEnabled?: boolean;
  lastWebhookAt?: string;
  lastWebhookCommit?: string;
  lastWebhookBranch?: string;
  lastWebhookAuthor?: string;
  // Scheduled indexing
  scheduledIndexingEnabled?: boolean;
  scheduledIndexingInterval?: number;
  scheduledIndexingBranch?: string;
  lastScheduledIndexingAt?: string;
  scheduledIndexingNextRun?: string;
}

interface IndexingJob {
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
  progress: number;
  currentFile?: string;
  totalFiles: number;
  processedFiles: number;
  vectorCount?: number;
  startTime: string;
  endTime?: string;
  error?: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [indexingJob, setIndexingJob] = useState<IndexingJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<'claude-code' | 'gemini'>('claude-code');

  // Webhook state
  const [webhookInfo, setWebhookInfo] = useState<{
    webhookUrl: string;
    webhookEnabled: boolean;
    lastWebhookAt?: string;
    lastWebhookCommit?: string;
    lastWebhookBranch?: string;
    lastWebhookAuthor?: string;
  }>({
    webhookUrl: '',
    webhookEnabled: false,
  });

  // Scheduled indexing state
  const [scheduledIndexingInfo, setScheduledIndexingInfo] = useState<{
    enabled: boolean;
    interval: number;
    branch: string;
    lastRun?: string;
    nextRun?: string;
  }>({
    enabled: false,
    interval: 60,
    branch: 'main',
  });

  useEffect(() => {
    loadProject();
    loadWebhookInfo();
    loadScheduledIndexingInfo();
    // Poll for indexing updates every 2 seconds
    const interval = setInterval(loadIndexingJob, 2000);
    return () => clearInterval(interval);
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else if (response.status === 404) {
        setError('Project not found');
      } else {
        setError('Failed to load project');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIndexingJob = async () => {
    try {
      const response = await fetch('/api/projects/indexing/status');
      if (response.ok) {
        const data = await response.json();
        const job = data.jobs[projectId];
        setIndexingJob(job || null);

        // If job completed, refresh project data
        if (!job && indexingJob) {
          await loadProject();
        }
      }
    } catch (error) {
      console.error('Failed to load indexing job:', error);
    }
  };

  const startIndexing = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadProject();
        await loadIndexingJob();
      }
    } catch (error) {
      console.error('Failed to start indexing:', error);
    }
  };

  const stopIndexing = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/index`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadProject();
        await loadIndexingJob();
      }
    } catch (error) {
      console.error('Failed to stop indexing:', error);
    }
  };

  const regenerateToken = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/token`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadProject();
        setShowTokenModal(false);
      }
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    }
  };

  const deleteProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const loadWebhookInfo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/webhook`);
      if (response.ok) {
        const data = await response.json();
        setWebhookInfo(data);
      }
    } catch (error) {
      console.error('Failed to load webhook info:', error);
    }
  };

  const toggleWebhook = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhookInfo.webhookEnabled }),
      });

      if (response.ok) {
        await loadWebhookInfo();
        await loadProject(); // Refresh project to get latest webhook info
      }
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  // Scheduled indexing functions
  const loadScheduledIndexingInfo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/schedule`);
      if (response.ok) {
        const data = await response.json();
        setScheduledIndexingInfo({
          enabled: data.scheduledIndexingEnabled || false,
          interval: data.scheduledIndexingInterval || 60,
          branch: data.scheduledIndexingBranch || 'main',
          lastRun: data.lastScheduledIndexingAt,
          nextRun: data.scheduledIndexingNextRun,
        });
      }
    } catch (error) {
      console.error('Failed to load scheduled indexing info:', error);
    }
  };

  const updateScheduledIndexing = async (enabled: boolean, interval?: number, branch?: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          intervalMinutes: enabled ? interval || scheduledIndexingInfo.interval : undefined,
          branch: branch || scheduledIndexingInfo.branch,
        }),
      });
      if (response.ok) {
        await loadScheduledIndexingInfo();
        await loadProject(); // Refresh project data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update scheduled indexing');
      }
    } catch (error) {
      console.error('Failed to update scheduled indexing:', error);
      alert('Failed to update scheduled indexing');
    }
  };

  const getStatusIcon = (status: Project['indexStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'ERROR':
        return <ExclamationCircleIcon className="h-6 w-6 text-red-500" />;
      case 'INDEXING':
        return <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = (status: Project['indexStatus']) => {
    switch (status) {
      case 'COMPLETED':
        return 'Indexed';
      case 'ERROR':
        return 'Failed';
      case 'INDEXING':
        return 'Indexing';
      default:
        return 'Idle';
    }
  };

  const generateConnectionCommand = (client: 'claude-code' | 'gemini') => {
    if (!project) return { title: '', description: '', command: '' };

    const serverUrl = `${window.location.origin}/api/mcp`;
    const serverName = `ideamem-${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    switch (client) {
      case 'claude-code':
        return {
          title: 'Claude Code CLI Command',
          description: 'Run this command in your terminal to add the MCP server:',
          command: `claude mcp add --transport http ${serverName} ${serverUrl} --header "Authorization: Bearer ${project.token}"`,
        };

      case 'gemini':
        return {
          title: 'Gemini Configuration',
          description: 'Add this MCP server configuration for Gemini:',
          command: JSON.stringify(
            {
              name: serverName,
              description: `Semantic memory for ${project.name}`,
              transport: {
                type: 'http',
                url: serverUrl,
                headers: {
                  Authorization: `Bearer ${project.token}`,
                },
              },
            },
            null,
            2
          ),
        };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 text-primary-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error || 'Project not found'}</h3>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">Project Details and Management</p>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-2"
        >
          <TrashIcon className="h-4 w-4" />
          Delete Project
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <p className="text-gray-900">{project.name}</p>
                </div>

                {project.description && (
                  <div>
                    <label className="label">Description</label>
                    <p className="text-gray-900">{project.description}</p>
                  </div>
                )}

                <div>
                  <label className="label">Git Repository</label>
                  <p className="text-gray-900 break-all">{project.gitRepo}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Created</label>
                    <div className="flex items-center text-gray-900">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {formatDate(project.createdAt)}
                    </div>
                  </div>

                  {project.indexedAt && (
                    <div>
                      <label className="label">Last Indexed</label>
                      <div className="flex items-center text-gray-900">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {formatDate(project.indexedAt)}
                      </div>
                    </div>
                  )}

                  {project.lastWebhookAt && (
                    <div>
                      <label className="label">Last Webhook</label>
                      <div className="flex items-center text-gray-900">
                        <BoltIcon className="h-4 w-4 mr-2" />
                        {formatDate(project.lastWebhookAt)}
                      </div>
                      {project.lastWebhookCommit && (
                        <p className="text-sm text-gray-600 ml-6">
                          Commit {project.lastWebhookCommit} by {project.lastWebhookAuthor} on{' '}
                          {project.lastWebhookBranch}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Query Metrics Card */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Query Activity</h2>

              {project.totalQueries && project.totalQueries > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <MagnifyingGlassIcon className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{project.totalQueries}</p>
                      <p className="text-sm text-gray-600">Total Queries</p>
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <ChartBarIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-600">
                        {project.queriesThisWeek || 0}
                      </p>
                      <p className="text-sm text-gray-600">This Week</p>
                    </div>

                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <ChartBarIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">
                        {project.queriesThisMonth || 0}
                      </p>
                      <p className="text-sm text-gray-600">This Month</p>
                    </div>
                  </div>

                  {project.lastQueryAt && (
                    <div className="text-center text-gray-600">
                      <p className="text-sm">Last query: {formatDate(project.lastQueryAt)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No queries received yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Queries will appear here once your MCP client starts using this project
                  </p>
                </div>
              )}
            </div>

            {/* Indexing Status Card */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Indexing Status</h2>

              <div className="flex items-center mb-4">
                {getStatusIcon(project.indexStatus)}
                <span
                  className={twMerge(
                    'ml-3 text-lg font-medium',
                    project.indexStatus === 'COMPLETED' && 'text-green-600',
                    project.indexStatus === 'ERROR' && 'text-red-600',
                    project.indexStatus === 'INDEXING' && 'text-blue-600',
                    project.indexStatus === 'IDLE' && 'text-gray-500'
                  )}
                >
                  {getStatusText(project.indexStatus)}
                </span>
              </div>

              {project.indexStatus === 'INDEXING' && indexingJob && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${indexingJob.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    {indexingJob.currentFile
                      ? `Processing: ${indexingJob.currentFile}`
                      : `${indexingJob.processedFiles}/${indexingJob.totalFiles} files`}
                  </p>
                </div>
              )}

              {project.indexStatus === 'COMPLETED' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <CodeBracketIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-600">{project.fileCount || 0}</p>
                    <p className="text-sm text-gray-600">Files Indexed</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <ServerIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{project.vectorCount || 0}</p>
                    <p className="text-sm text-gray-600">Vector Embeddings</p>
                  </div>
                </div>
              )}

              {project.indexStatus === 'ERROR' && project.lastError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-red-700">{project.lastError}</p>
                </div>
              )}

              {/* Indexing Actions */}
              <div className="flex gap-3">
                {project.indexStatus === 'INDEXING' ? (
                  <button
                    onClick={stopIndexing}
                    className="btn bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-2"
                  >
                    <StopIcon className="h-4 w-4" />
                    Stop Indexing
                  </button>
                ) : (
                  <button
                    onClick={startIndexing}
                    className="btn bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-2"
                  >
                    <PlayIcon className="h-4 w-4" />
                    {project.indexStatus === 'COMPLETED' ? 'Reindex' : 'Start Indexing'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            {/* Token Management */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Authentication Token</h3>
              <p className="text-gray-600 text-sm mb-4">
                Use this token to authenticate MCP clients for this project.
              </p>
              <button
                onClick={() => setShowTokenModal(true)}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <KeyIcon className="h-4 w-4" />
                Manage Token
              </button>
            </div>

            {/* MCP Connection */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">MCP Connection</h3>
              <p className="text-gray-600 text-sm mb-4">
                Generate connection commands for your MCP clients.
              </p>
              <button
                onClick={() => setShowConnectionModal(true)}
                className="btn bg-purple-100 text-purple-700 hover:bg-purple-200 w-full flex items-center justify-center gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                Connection Setup
              </button>
            </div>

            {/* Webhook Management */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auto Re-indexing</h3>
              <p className="text-gray-600 text-sm mb-4">
                Automatically re-index when code changes are pushed to your repository.
              </p>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Webhook Status</span>
                <span
                  className={twMerge(
                    'text-sm font-medium',
                    webhookInfo.webhookEnabled ? 'text-green-600' : 'text-gray-500'
                  )}
                >
                  {webhookInfo.webhookEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <button
                onClick={() => setShowWebhookModal(true)}
                className="btn bg-orange-100 text-orange-700 hover:bg-orange-200 w-full flex items-center justify-center gap-2"
              >
                <BoltIcon className="h-4 w-4" />
                Webhook Setup
              </button>
            </div>

            {/* Scheduled Indexing */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Indexing</h3>
              <p className="text-gray-600 text-sm mb-4">
                Automatically check for changes and re-index when webhooks aren't available.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <span
                    className={twMerge(
                      'text-sm font-medium',
                      scheduledIndexingInfo.enabled ? 'text-green-600' : 'text-gray-500'
                    )}
                  >
                    {scheduledIndexingInfo.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {scheduledIndexingInfo.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Interval</span>
                      <span className="text-sm text-gray-600">
                        {scheduledIndexingInfo.interval >= 60
                          ? `${Math.floor(scheduledIndexingInfo.interval / 60)}h ${scheduledIndexingInfo.interval % 60}m`
                          : `${scheduledIndexingInfo.interval}m`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Branch</span>
                      <span className="text-sm text-gray-600 font-mono">
                        {scheduledIndexingInfo.branch}
                      </span>
                    </div>

                    {scheduledIndexingInfo.nextRun && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Next Run</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(scheduledIndexingInfo.nextRun)}
                        </span>
                      </div>
                    )}

                    {scheduledIndexingInfo.lastRun && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Last Run</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(scheduledIndexingInfo.lastRun)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  {!scheduledIndexingInfo.enabled ? (
                    <div className="space-y-2">
                      <select
                        className="input text-sm"
                        value={scheduledIndexingInfo.interval}
                        onChange={(e) =>
                          setScheduledIndexingInfo((prev) => ({
                            ...prev,
                            interval: parseInt(e.target.value),
                          }))
                        }
                      >
                        <option value={5}>Every 5 minutes</option>
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes</option>
                        <option value={60}>Every hour</option>
                        <option value={120}>Every 2 hours</option>
                        <option value={360}>Every 6 hours</option>
                        <option value={720}>Every 12 hours</option>
                        <option value={1440}>Every 24 hours</option>
                      </select>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Branch (default: main)"
                        value={scheduledIndexingInfo.branch}
                        onChange={(e) =>
                          setScheduledIndexingInfo((prev) => ({
                            ...prev,
                            branch: e.target.value || 'main',
                          }))
                        }
                      />
                      <button
                        onClick={() => updateScheduledIndexing(true)}
                        className="btn bg-green-100 text-green-700 hover:bg-green-200 w-full flex items-center justify-center gap-2"
                      >
                        <ClockIcon className="h-4 w-4" />
                        Enable Scheduling
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => updateScheduledIndexing(false)}
                      className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 w-full flex items-center justify-center gap-2"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      Disable Scheduling
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Project Rules */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Rules</h3>
              <p className="text-gray-600 text-sm mb-4">
                Manage project-specific coding standards that override global rules.
              </p>
              <button
                onClick={() => setShowRulesModal(true)}
                className="btn bg-blue-100 text-blue-700 hover:bg-blue-200 w-full flex items-center justify-center gap-2"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                Manage Rules
              </button>
            </div>

            {/* Project Preferences */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Preferences</h3>
              <p className="text-gray-600 text-sm mb-4">
                Customize project settings that override global preferences.
              </p>
              <button
                onClick={() => setShowPreferencesModal(true)}
                className="btn bg-purple-100 text-purple-700 hover:bg-purple-200 w-full flex items-center justify-center gap-2"
              >
                <CogIcon className="h-4 w-4" />
                Manage Preferences
              </button>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                {project.indexStatus === 'COMPLETED' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Files</span>
                      <span className="font-medium">{project.fileCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vectors</span>
                      <span className="font-medium">{project.vectorCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium text-green-600">Indexed</span>
                    </div>
                    <hr className="border-gray-200" />
                  </>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">Total Queries</span>
                  <span className="font-medium">{project.totalQueries || 0}</span>
                </div>

                {project.totalQueries && project.totalQueries > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">This Week</span>
                      <span className="font-medium">{project.queriesThisWeek || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">This Month</span>
                      <span className="font-medium">{project.queriesThisMonth || 0}</span>
                    </div>
                  </>
                )}

                {!project.totalQueries || project.totalQueries === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No queries yet</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      {/* Token Modal */}
      <Dialog open={showTokenModal} onClose={() => setShowTokenModal(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Authentication Token
            </Dialog.Title>

            <p className="text-gray-600 mb-4">
              Use this token to authenticate MCP clients for "{project.name}".
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <code className="text-sm font-mono text-gray-900 break-all">{project.token}</code>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => navigator.clipboard.writeText(project.token)}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy Token
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure? This will invalidate the current token.')) {
                    regenerateToken();
                  }
                }}
                className="btn bg-yellow-100 text-yellow-700 hover:bg-yellow-200 flex-1"
              >
                Regenerate
              </button>
            </div>

            <button onClick={() => setShowTokenModal(false)} className="btn btn-primary w-full">
              Close
            </button>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Connection Modal */}
      <Dialog open={showConnectionModal} onClose={() => setShowConnectionModal(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              MCP Connection Configuration
            </Dialog.Title>

            <p className="text-gray-600 mb-6">
              Configure your MCP client to connect to the "{project.name}" project.
            </p>

            {/* Client Selection */}
            <div className="mb-6">
              <label className="label">Select MCP Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value as 'claude-code' | 'gemini')}
                className="input"
              >
                <option value="claude-code">Claude Code</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>

            {(() => {
              const config = generateConnectionCommand(selectedClient);
              return (
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{config.title}</h3>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs font-mono text-gray-900 whitespace-pre-wrap break-all">
                      {config.command}
                    </pre>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(config.command)}
                      className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <CommandLineIcon className="h-4 w-4" />
                      Copy Configuration
                    </button>
                    <button
                      onClick={() => setShowConnectionModal(false)}
                      className="btn btn-primary flex-1"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Delete Project
            </Dialog.Title>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{project.name}"? This will permanently delete the
              project and all its indexed data. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button onClick={deleteProject} className="btn btn-danger flex-1">
                Delete Project
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Webhook Setup Modal */}
      <Dialog open={showWebhookModal} onClose={() => setShowWebhookModal(false)}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <Dialog.Title className="text-xl font-semibold text-gray-900 mb-4">
              Webhook Auto Re-indexing Setup
            </Dialog.Title>

            <p className="text-gray-600 mb-6">
              Configure your Git hosting platform to automatically re-index "{project?.name}" when
              code changes are pushed.
            </p>

            {/* Webhook Status Toggle */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Webhook Status</h3>
                  <p className="text-sm text-gray-600">Enable or disable automatic re-indexing</p>
                </div>
                <button
                  onClick={toggleWebhook}
                  className={twMerge(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    webhookInfo.webhookEnabled ? 'bg-green-600' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={twMerge(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      webhookInfo.webhookEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center text-sm">
                <div
                  className={twMerge(
                    'flex items-center gap-2',
                    webhookInfo.webhookEnabled ? 'text-green-600' : 'text-gray-500'
                  )}
                >
                  <BoltIcon className="h-4 w-4" />
                  {webhookInfo.webhookEnabled ? 'Webhook Enabled' : 'Webhook Disabled'}
                </div>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="mb-6">
              <label className="label">Webhook URL</label>
              <p className="text-sm text-gray-600 mb-2">
                Add this URL to your Git hosting platform's webhook settings:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-2">
                <code className="text-sm font-mono text-gray-900 break-all">
                  {webhookInfo.webhookUrl}
                </code>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(webhookInfo.webhookUrl)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy Webhook URL
              </button>
            </div>

            {/* Setup Instructions */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Setup Instructions</h3>

              <div className="space-y-4">
                {/* GitHub Instructions */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <GlobeAltIcon className="h-4 w-4" />
                    GitHub
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 ml-6 list-decimal">
                    <li>Go to your repository → Settings → Webhooks</li>
                    <li>Click "Add webhook"</li>
                    <li>Paste the webhook URL above</li>
                    <li>Set Content type to "application/json"</li>
                    <li>Select "Just the push event"</li>
                    <li>Click "Add webhook"</li>
                  </ol>
                </div>

                {/* GitLab Instructions */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <GlobeAltIcon className="h-4 w-4" />
                    GitLab
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 ml-6 list-decimal">
                    <li>Go to your project → Settings → Webhooks</li>
                    <li>Paste the webhook URL above</li>
                    <li>Select "Push events" trigger</li>
                    <li>Click "Add webhook"</li>
                  </ol>
                </div>

                {/* Bitbucket Instructions */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <GlobeAltIcon className="h-4 w-4" />
                    Bitbucket
                  </h4>
                  <ol className="text-sm text-gray-600 space-y-1 ml-6 list-decimal">
                    <li>Go to your repository → Settings → Webhooks</li>
                    <li>Click "Add webhook"</li>
                    <li>Paste the webhook URL above</li>
                    <li>Select "Repository push" trigger</li>
                    <li>Click "Save"</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Last Webhook Info */}
            {project?.lastWebhookAt && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Last Webhook Activity</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>
                    <strong>Time:</strong> {formatDate(project.lastWebhookAt)}
                  </p>
                  {project.lastWebhookCommit && (
                    <>
                      <p>
                        <strong>Commit:</strong> {project.lastWebhookCommit}
                      </p>
                      <p>
                        <strong>Branch:</strong> {project.lastWebhookBranch}
                      </p>
                      <p>
                        <strong>Author:</strong> {project.lastWebhookAuthor}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowWebhookModal(false)} className="btn btn-primary flex-1">
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Project Rules Manager Modal */}
      <ProjectRulesManager
        projectId={project.id}
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Project Preferences Manager Modal */}
      <ProjectPreferencesManager
        projectId={project.id}
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </div>
  );
}
