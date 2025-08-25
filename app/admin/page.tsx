'use client';

import { useState, useEffect, FormEvent } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ServerIcon,
  CpuChipIcon,
  CloudArrowDownIcon,
  DocumentIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';


interface AppConfig {
  qdrantUrl: string;
  ollamaUrl: string;
  docReindexEnabled: boolean;
  docReindexInterval: number; // days
}

interface Status {
  status: 'ok' | 'error' | 'unknown' | 'not_found' | 'pulling_started';
  message: string;
}

export default function AdminPage() {
  const [config, setConfig] = useState<AppConfig>({ 
    qdrantUrl: '', 
    ollamaUrl: '',
    docReindexEnabled: true,
    docReindexInterval: 14,
  });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [qdrantStatus, setQdrantStatus] = useState<Status>({ status: 'unknown', message: '' });
  const [ollamaStatus, setOllamaStatus] = useState<Status>({ status: 'unknown', message: '' });
  const [embeddingStatus, setEmbeddingStatus] = useState<Status>({
    status: 'unknown',
    message: '',
  });
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig({
            qdrantUrl: data.qdrantUrl || '',
            ollamaUrl: data.ollamaUrl || '',
            docReindexEnabled: data.docReindexEnabled ?? true,
            docReindexInterval: data.docReindexInterval ?? 14,
          });
        }
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true);
      });
  }, []);

  const handleTestConnection = async (service: 'qdrant' | 'ollama' | 'ollama-embedding') => {
    setIsTesting(true);
    const statusSetter = {
      qdrant: setQdrantStatus,
      ollama: setOllamaStatus,
      'ollama-embedding': setEmbeddingStatus,
    }[service];

    statusSetter({ status: 'unknown', message: 'Testing...' });

    const response = await fetch('/api/admin/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service }),
    });
    const result = await response.json();

    statusSetter(result);
    setIsTesting(false);
  };

  const handlePullModel = async () => {
    setIsTesting(true);
    setEmbeddingStatus({ status: 'unknown', message: 'Initiating pull...' });
    const response = await fetch('/api/admin/pull-model', { method: 'POST' });
    const result = await response.json();
    setEmbeddingStatus(result);
    setIsTesting(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveMessage('');
    const response = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const result = await response.json();
    setSaveMessage(result.message);
  };


  const getStatusIcon = (status: Status['status']) => {
    const className = 'h-5 w-5';
    switch (status) {
      case 'ok':
        return <CheckCircleIcon className={twMerge(className, 'text-green-500')} />;
      case 'error':
        return <ExclamationCircleIcon className={twMerge(className, 'text-red-500')} />;
      case 'not_found':
        return <ExclamationCircleIcon className={twMerge(className, 'text-orange-500')} />;
      case 'pulling_started':
        return <CloudArrowDownIcon className={twMerge(className, 'text-blue-500')} />;
      default:
        return <ClockIcon className={twMerge(className, 'text-gray-400')} />;
    }
  };

  const getStatusColor = (status: Status['status']) => {
    switch (status) {
      case 'ok':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'not_found':
        return 'text-orange-600';
      case 'pulling_started':
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600 mt-1">
            Configure external services and system health
          </p>
        </div>
      </div>
      
      {/* Introduction */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary-100 rounded-lg">
            <ServerIcon className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Service Configuration</h2>
                <p className="text-gray-600">
                  Configure and test connections to the required services for IdeaMem to function
                  properly.
                </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Qdrant Configuration */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ServerIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Qdrant Vector Database</h3>
                    <p className="text-sm text-gray-600">
                      High-performance vector similarity search engine
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(qdrantStatus.status)}
                  <span
                    className={twMerge('text-sm font-medium', getStatusColor(qdrantStatus.status))}
                  >
                    {qdrantStatus.message || 'Not tested'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Connection URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="http://localhost:6333"
                      value={config.qdrantUrl}
                      onChange={(e) => setConfig({ ...config, qdrantUrl: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleTestConnection('qdrant')}
                      disabled={isTesting}
                      className="btn btn-secondary whitespace-nowrap"
                    >
                      {isTesting ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ollama Configuration */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CpuChipIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Ollama AI Service</h3>
                    <p className="text-sm text-gray-600">Local AI inference for text embeddings</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(ollamaStatus.status)}
                  <span
                    className={twMerge('text-sm font-medium', getStatusColor(ollamaStatus.status))}
                  >
                    {ollamaStatus.message || 'Not tested'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Connection URL</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="http://localhost:11434"
                      value={config.ollamaUrl}
                      onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => handleTestConnection('ollama')}
                      disabled={isTesting}
                      className="btn btn-secondary whitespace-nowrap"
                    >
                      {isTesting ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                  </div>
                </div>

                {/* Embedding Model Section */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Nomic Embed Text Model</h4>
                      <p className="text-sm text-gray-600">
                        Required for generating text embeddings
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(embeddingStatus.status)}
                      <span
                        className={twMerge(
                          'text-sm font-medium',
                          getStatusColor(embeddingStatus.status)
                        )}
                      >
                        {embeddingStatus.message || 'Not tested'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleTestConnection('ollama-embedding')}
                      disabled={isTesting}
                      className="btn btn-secondary"
                    >
                      Test Model
                    </button>
                    {embeddingStatus.status === 'not_found' && (
                      <button
                        type="button"
                        onClick={handlePullModel}
                        disabled={isTesting}
                        className="btn bg-orange-100 text-orange-700 hover:bg-orange-200"
                      >
                        <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                        Pull Model
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>


            {/* Documentation Scheduling */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DocumentIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Documentation Scheduling</h3>
                    <p className="text-sm text-gray-600">
                      Automated reindexing of all documentation sources
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {configLoaded ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-gray-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">Automatic Reindexing</h4>
                        <p className="text-sm text-gray-600">
                          Enable scheduled reindexing of all documentation sources
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.docReindexEnabled}
                          onChange={(e) => setConfig({ ...config, docReindexEnabled: e.target.checked })}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enabled</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                      <div>
                        <div className="h-4 w-32 bg-gray-300 rounded mb-1"></div>
                        <div className="h-3 w-48 bg-gray-300 rounded"></div>
                      </div>
                    </div>
                    <div className="h-4 w-16 bg-gray-300 rounded"></div>
                  </div>
                )}

                {configLoaded ? (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="label">Reindexing Interval</label>
                    <div className="flex items-center gap-3 mt-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        step="1"
                        value={config.docReindexInterval}
                        onChange={(e) => setConfig({ ...config, docReindexInterval: parseInt(e.target.value) || 14 })}
                        className="input w-32"
                        disabled={!config.docReindexEnabled}
                      />
                      <span className="text-sm text-gray-600">days</span>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-blue-700">
                        <strong>Note:</strong> All documentation sources are checked every {config.docReindexInterval} days since their last indexing. Git repositories only reindex when new commits are detected, while web sources always reindex on schedule.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 animate-pulse">
                    <div className="h-5 w-24 bg-blue-200 rounded mb-2"></div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-8 w-32 bg-blue-200 rounded"></div>
                      <div className="h-4 w-8 bg-blue-200 rounded"></div>
                    </div>
                    <div className="mt-3">
                      <div className="h-3 w-full bg-blue-200 rounded mb-1"></div>
                      <div className="h-3 w-3/4 bg-blue-200 rounded"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* Save Button */}
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary">
                Save Configuration
              </button>
            </div>

            {/* Save Message */}
            {saveMessage && (
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-md">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <span className="text-green-700">{saveMessage}</span>
              </div>
        )}
      </form>
    </div>
  );
}
