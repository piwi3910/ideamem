'use client';

import { useState, useEffect } from 'react';
import DocumentGraph from '../../components/DocumentGraph';
import {
  RelationshipAnalyzer,
  DocumentGraph as DocumentGraphType,
  DocumentNode,
  DocumentRelationship,
} from '../../lib/relationship-analyzer';

interface RelatedDocument {
  document: DocumentNode;
  relationship: DocumentRelationship;
}

export default function NetworkPage() {
  const [documentGraph, setDocumentGraph] = useState<DocumentGraphType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [graphOptions, setGraphOptions] = useState({
    includeWeakRelationships: false,
    minStrength: 0.3,
    maxNodes: 100,
  });

  // Load the documentation graph
  useEffect(() => {
    loadDocumentationGraph();
  }, [graphOptions]);

  // Load related documents when a node is selected
  useEffect(() => {
    if (selectedNodeId) {
      loadRelatedDocuments(selectedNodeId);
    } else {
      setRelatedDocuments([]);
    }
  }, [selectedNodeId]);

  const loadDocumentationGraph = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/network/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graphOptions),
      });

      if (!response.ok) {
        throw new Error(`Failed to load graph: ${response.statusText}`);
      }

      const graph = await response.json();
      setDocumentGraph(graph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documentation graph');
      console.error('Error loading documentation graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedDocuments = async (documentId: string) => {
    try {
      setLoadingRelated(true);

      const response = await fetch('/api/network/related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          limit: 10,
          minStrength: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load related documents: ${response.statusText}`);
      }

      const related = await response.json();
      setRelatedDocuments(related);
    } catch (err) {
      console.error('Error loading related documents:', err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleNodeSelect = (node: DocumentNode) => {
    setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
  };

  const handleRelationshipSelect = (relationship: DocumentRelationship) => {
    console.log('Selected relationship:', relationship);
    // Could show relationship details in a modal
  };

  const resetGraph = () => {
    setGraphOptions({
      includeWeakRelationships: false,
      minStrength: 0.3,
      maxNodes: 100,
    });
    setSelectedNodeId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Building documentation network...</p>
          <p className="text-sm text-gray-500">
            This may take a moment while we analyze relationships
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Error: </strong>
            <span>{error}</span>
          </div>
          <button
            onClick={loadDocumentationGraph}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!documentGraph) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">No documentation network available</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure you have indexed some documentation first
          </p>
          <button
            onClick={() => (window.location.href = '/admin')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
          >
            Go to Admin
          </button>
          <button
            onClick={loadDocumentationGraph}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Documentation Network</h1>
              <p className="text-sm text-gray-500 mt-1">
                Interactive visualization of document relationships and knowledge graphs
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={resetGraph}
                className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
              >
                Reset View
              </button>
              <button
                onClick={loadDocumentationGraph}
                className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                Refresh Graph
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Graph */}
          <div className="lg:col-span-3">
            <DocumentGraph
              nodes={documentGraph.nodes}
              relationships={documentGraph.relationships}
              clusters={documentGraph.clusters}
              metrics={documentGraph.metrics}
              onNodeSelect={handleNodeSelect}
              onRelationshipSelect={handleRelationshipSelect}
              width={900}
              height={600}
              interactive={true}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Graph Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold mb-4">Graph Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={graphOptions.includeWeakRelationships}
                      onChange={(e) =>
                        setGraphOptions((prev) => ({
                          ...prev,
                          includeWeakRelationships: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    <span className="text-sm">Include weak relationships</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Strength: {graphOptions.minStrength}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={graphOptions.minStrength}
                    onChange={(e) =>
                      setGraphOptions((prev) => ({
                        ...prev,
                        minStrength: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Nodes: {graphOptions.maxNodes}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={graphOptions.maxNodes}
                    onChange={(e) =>
                      setGraphOptions((prev) => ({
                        ...prev,
                        maxNodes: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Network Statistics */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold mb-4">Network Statistics</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Documents:</span>
                  <span className="font-semibold">{documentGraph.metrics.totalNodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Relationships:</span>
                  <span className="font-semibold">{documentGraph.metrics.totalRelationships}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Density:</span>
                  <span className="font-semibold">
                    {(documentGraph.metrics.density * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Connections:</span>
                  <span className="font-semibold">
                    {documentGraph.metrics.avgConnections.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Clusters:</span>
                  <span className="font-semibold">{documentGraph.clusters.length}</span>
                </div>
              </div>
            </div>

            {/* Top Connected Documents */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold mb-4">Most Connected</h3>

              <div className="space-y-2">
                {documentGraph.metrics.topConnectedNodes.slice(0, 5).map((node) => (
                  <div
                    key={node.nodeId}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedNodeId === node.nodeId
                        ? 'bg-blue-100 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() =>
                      setSelectedNodeId(selectedNodeId === node.nodeId ? null : node.nodeId)
                    }
                  >
                    <div className="font-medium text-sm">{node.title}</div>
                    <div className="text-xs text-gray-500">{node.connections} connections</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Related Documents */}
            {selectedNodeId && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-semibold mb-4">Related Documents</h3>

                {loadingRelated ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading...</p>
                  </div>
                ) : relatedDocuments.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {relatedDocuments.map(({ document, relationship }) => (
                      <div key={document.id} className="p-2 border border-gray-200 rounded">
                        <div className="font-medium text-sm mb-1">{document.title}</div>
                        <div className="text-xs text-gray-500 mb-1">
                          {relationship.relationshipType} •{' '}
                          {(relationship.strength * 100).toFixed(0)}% strength
                        </div>
                        {relationship.context && (
                          <div className="text-xs text-gray-400">{relationship.context}</div>
                        )}
                        {document.url && (
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 text-xs underline mt-1 inline-block"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No related documents found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
