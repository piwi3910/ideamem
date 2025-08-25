'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ServerIcon,
  CpuChipIcon,
  CloudArrowDownIcon,
} from '@heroicons/react/24/outline';
import { twMerge } from 'tailwind-merge';


interface AppConfig {
  qdrantUrl: string;
  ollamaUrl: string;
}

interface Status {
  status: 'ok' | 'error' | 'unknown' | 'not_found' | 'pulling_started';
  message: string;
}

export default function AdminPage() {
  const [config, setConfig] = useState<AppConfig>({ qdrantUrl: '', ollamaUrl: '' });
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
          setConfig(data);
        }
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


            {/* Background Job Processing */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Background Job Processing</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Automated indexing and scheduling with BullMQ + Redis
                </p>
              </div>
              
              <div className="p-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                    <h4 className="font-medium text-green-900">✅ Fully Automated System</h4>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    All background processing is now handled automatically. No manual intervention required.
                  </p>
                  <div className="text-xs text-green-600 space-y-1 pl-4">
                    <div>• Workers auto-start when the application launches</div>
                    <div>• Indexing jobs queue automatically when projects are updated</div>
                    <div>• Scheduled indexing runs based on each project's configured interval</div>
                    <div>• Failed jobs retry automatically with smart backoff timing</div>
                    <div>• Redis provides persistent job storage and coordination</div>
                  </div>
                </div>

                <div className="mt-4 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">🔧 Queue Types</h4>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div><strong>indexing</strong> - Manual and webhook-triggered indexing jobs</div>
                    <div><strong>scheduled-indexing</strong> - Automated recurring indexing based on project settings</div>
                    <div><strong>cleanup</strong> - Maintenance tasks and resource cleanup</div>
                  </div>
                </div>
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
