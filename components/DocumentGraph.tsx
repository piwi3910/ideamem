'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type {
  DocumentNode,
  DocumentRelationship,
  DocumentCluster,
  GraphMetrics,
} from '../lib/relationship-analyzer';

// Extend DocumentNode to work with D3 force simulation
interface D3DocumentNode extends DocumentNode, d3.SimulationNodeDatum {}

// Extend DocumentRelationship to work with D3 force simulation
interface D3DocumentRelationship extends Omit<DocumentRelationship, 'sourceId' | 'targetId'> {
  source: string | D3DocumentNode;
  target: string | D3DocumentNode;
}

interface DocumentGraphProps {
  nodes: DocumentNode[];
  relationships: DocumentRelationship[];
  clusters: DocumentCluster[];
  metrics: GraphMetrics;
  onNodeSelect?: (node: DocumentNode) => void;
  onRelationshipSelect?: (relationship: DocumentRelationship) => void;
  width?: number;
  height?: number;
  interactive?: boolean;
}

export default function DocumentGraph({
  nodes,
  relationships,
  clusters,
  metrics,
  onNodeSelect,
  onRelationshipSelect,
  width = 1000,
  height = 600,
  interactive = true,
}: DocumentGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [showClusters, setShowClusters] = useState(true);
  const [filterStrength, setFilterStrength] = useState(0.3);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const container = svg.append('g');

    // Convert nodes to D3 nodes
    const d3Nodes: D3DocumentNode[] = nodes.map((node) => ({ ...node }));

    // Filter relationships by strength
    const baseRelationships = relationships.filter((rel) => rel.strength >= filterStrength);

    // Convert relationships to D3 links
    const filteredRelationships = baseRelationships.map(
      (rel) =>
        ({
          ...rel,
          source: rel.sourceId,
          target: rel.targetId,
        }) as D3DocumentRelationship
    );

    // Set up zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    if (interactive) {
      svg.call(zoomBehavior);
    }

    // Create force simulation
    const simulation = d3
      .forceSimulation(d3Nodes)
      .force(
        'link',
        d3
          .forceLink(filteredRelationships)
          .id((d: any) => d.id)
          .distance((d) => 100 / (d as D3DocumentRelationship).strength)
      )
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Draw cluster backgrounds if enabled
    const clusterGroups = container
      .selectAll('.cluster')
      .data(showClusters ? clusters : [])
      .enter()
      .append('g')
      .attr('class', 'cluster');

    // Draw relationship lines
    const links = container
      .selectAll('.link')
      .data(filteredRelationships)
      .enter()
      .append('line')
      .attr('class', 'link')
      .style('stroke', (d) => getRelationshipColor(d.relationshipType))
      .style('stroke-width', (d) => Math.max(1, d.strength * 4))
      .style('stroke-opacity', (d) => 0.3 + d.strength * 0.7)
      .style('stroke-dasharray', (d) => (d.bidirectional ? 'none' : '5,5'));

    // Add arrow markers for directed relationships
    const relationshipTypes = ['references', 'imports', 'links_to', 'builds_on'] as const;
    svg
      .append('defs')
      .selectAll('marker')
      .data(relationshipTypes)
      .enter()
      .append('marker')
      .attr('id', (d) => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .style('fill', (d) => getRelationshipColor(d));

    links.attr('marker-end', (d) =>
      d.bidirectional ? 'none' : `url(#arrow-${d.relationshipType})`
    );

    // Draw nodes
    const nodeGroups = container
      .selectAll('.node')
      .data(d3Nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', interactive ? 'pointer' : 'default');

    // Node circles
    nodeGroups
      .append('circle')
      .attr('r', (d) => 8 + Math.sqrt(d.popularity) * 2)
      .style('fill', (d) => getNodeColor(d))
      .style('stroke', (d) => (selectedNode?.id === d.id ? '#ff6b6b' : '#fff'))
      .style('stroke-width', (d) => (selectedNode?.id === d.id ? 3 : 1.5))
      .style('opacity', (d) => {
        if (!selectedCluster) return 1;
        const cluster = clusters.find((c) => c.id === selectedCluster);
        return cluster?.nodeIds.includes(d.id) ? 1 : 0.3;
      });

    // Node labels
    nodeGroups
      .append('text')
      .text((d) => (d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title))
      .style('font-size', `${Math.max(8, 12 / zoom)}px`)
      .style('font-weight', '500')
      .style('fill', '#333')
      .style('text-anchor', 'middle')
      .attr('dy', (d) => 12 + Math.sqrt(d.popularity) * 2 + 8);

    // Node complexity indicators
    nodeGroups
      .append('circle')
      .attr('r', 3)
      .attr('cx', (d) => 8 + Math.sqrt(d.popularity) * 2 - 3)
      .attr('cy', (d) => -(8 + Math.sqrt(d.popularity) * 2 - 3))
      .style('fill', (d) => getComplexityColor(d.complexity))
      .style('stroke', '#fff')
      .style('stroke-width', 1);

    // Add interaction handlers
    if (interactive) {
      nodeGroups.on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(selectedNode?.id === d.id ? null : d);
        onNodeSelect?.(d);
      });

      nodeGroups.on('mouseenter', function (event, d) {
        // Highlight connected nodes and relationships
        const connectedNodeIds = new Set<string>();
        connectedNodeIds.add(d.id);

        baseRelationships.forEach((rel) => {
          if (rel.sourceId === d.id || rel.targetId === d.id) {
            connectedNodeIds.add(rel.sourceId);
            connectedNodeIds.add(rel.targetId);
          }
        });

        nodeGroups.style('opacity', (node) => (connectedNodeIds.has(node.id) ? 1 : 0.3));
        links.style('opacity', (rel, i) => {
          const originalRel = baseRelationships[i];
          return originalRel.sourceId === d.id || originalRel.targetId === d.id ? 0.8 : 0.1;
        });

        // Show tooltip
        showTooltip(event, d);
      });

      nodeGroups.on('mouseleave', () => {
        nodeGroups.style('opacity', 1);
        links.style('opacity', (d) => 0.3 + d.strength * 0.7);
        hideTooltip();
      });

      // Link interaction
      links.on('click', function (event, d) {
        event.stopPropagation();
        // Find the original relationship by matching D3 data
        const index = filteredRelationships.indexOf(d);
        if (index >= 0) {
          const originalRel = baseRelationships[index];
          onRelationshipSelect?.(originalRel);
        }
      });
    }

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d) => (d.source as any).x)
        .attr('y1', (d) => (d.source as any).y)
        .attr('x2', (d) => (d.target as any).x)
        .attr('y2', (d) => (d.target as any).y);

      nodeGroups.attr('transform', (d) => `translate(${(d as any).x},${(d as any).y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, relationships, clusters, filterStrength, showClusters, selectedNode, selectedCluster]);

  const showTooltip = (event: MouseEvent, node: DocumentNode) => {
    const tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('z-index', 1000)
      .style('pointer-events', 'none')
      .style('opacity', 0);

    const connectionCount = relationships.filter(
      (rel) => rel.sourceId === node.id || rel.targetId === node.id
    ).length;

    tooltip.html(`
      <div><strong>${node.title}</strong></div>
      <div>Type: ${node.contentType}</div>
      <div>Language: ${node.language || 'Unknown'}</div>
      <div>Complexity: ${node.complexity}</div>
      <div>Popularity: ${node.popularity}</div>
      <div>Connections: ${connectionCount}</div>
      <div>Category: ${node.category}</div>
    `);

    tooltip
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY - 10 + 'px')
      .transition()
      .duration(200)
      .style('opacity', 1);
  };

  const hideTooltip = () => {
    d3.selectAll('.graph-tooltip').remove();
  };

  const getNodeColor = (node: DocumentNode): string => {
    if (node.contentType === 'api') return '#e74c3c';
    if (node.contentType === 'tutorial') return '#2ecc71';
    if (node.contentType === 'guide') return '#3498db';
    if (node.contentType === 'example') return '#f39c12';
    if (node.contentType === 'reference') return '#9b59b6';
    return '#34495e';
  };

  const getRelationshipColor = (type: DocumentRelationship['relationshipType']): string => {
    switch (type) {
      case 'references':
        return '#3498db';
      case 'imports':
        return '#e74c3c';
      case 'links_to':
        return '#2ecc71';
      case 'builds_on':
        return '#f39c12';
      case 'extends':
        return '#9b59b6';
      default:
        return '#95a5a6';
    }
  };

  const getComplexityColor = (complexity: string): string => {
    switch (complexity) {
      case 'beginner':
        return '#2ecc71';
      case 'intermediate':
        return '#f39c12';
      case 'advanced':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg">
      {/* Graph Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Documentation Network</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showClusters}
                onChange={(e) => setShowClusters(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600">Show Clusters</span>
            </label>
            <div className="flex items-center">
              <label className="text-sm text-gray-600 mr-2">Min Strength:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={filterStrength}
                onChange={(e) => setFilterStrength(parseFloat(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-gray-500 ml-2">{filterStrength}</span>
            </div>
          </div>
        </div>

        {/* Cluster Selection */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`px-3 py-1 rounded-full text-sm ${
              !selectedCluster
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {clusters.map((cluster) => (
            <button
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster.id === selectedCluster ? null : cluster.id)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCluster === cluster.id
                  ? 'text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              style={{
                backgroundColor: selectedCluster === cluster.id ? cluster.color : undefined,
              }}
            >
              {cluster.name} ({cluster.nodeIds.length})
            </button>
          ))}
        </div>

        {/* Graph Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-blue-600">{metrics.totalNodes}</div>
            <div className="text-gray-500">Documents</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">{metrics.totalRelationships}</div>
            <div className="text-gray-500">Connections</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-purple-600">
              {(metrics.density * 100).toFixed(1)}%
            </div>
            <div className="text-gray-500">Density</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-orange-600">{metrics.avgConnections.toFixed(1)}</div>
            <div className="text-gray-500">Avg Connections</div>
          </div>
        </div>
      </div>

      {/* Graph Container */}
      <div className="relative">
        <svg ref={svgRef} width={width} height={height} className="border border-gray-200" />

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md text-sm">
          <h4 className="font-semibold mb-3">Legend</h4>

          {/* Node Types */}
          <div className="mb-3">
            <div className="font-medium mb-1">Content Types:</div>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span>API Reference</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span>Tutorial</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span>Guide</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                <span>Example</span>
              </div>
            </div>
          </div>

          {/* Relationship Types */}
          <div className="mb-3">
            <div className="font-medium mb-1">Relationships:</div>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-4 h-0 border-t-2 border-blue-500 mr-2"></div>
                <span>References</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0 border-t-2 border-red-500 mr-2"></div>
                <span>Imports</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0 border-t-2 border-green-500 mr-2"></div>
                <span>Links To</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-0 border-t-2 border-yellow-500 mr-2"></div>
                <span>Builds On</span>
              </div>
            </div>
          </div>

          {/* Complexity */}
          <div>
            <div className="font-medium mb-1">Complexity:</div>
            <div className="space-y-1">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span>Beginner</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                <span>Intermediate</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                <span>Advanced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <h4 className="font-semibold text-lg mb-2">{selectedNode.title}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span> {selectedNode.contentType}
            </div>
            <div>
              <span className="text-gray-500">Language:</span> {selectedNode.language || 'N/A'}
            </div>
            <div>
              <span className="text-gray-500">Complexity:</span> {selectedNode.complexity}
            </div>
            <div>
              <span className="text-gray-500">Popularity:</span> {selectedNode.popularity}
            </div>
          </div>
          {selectedNode.keywords.length > 0 && (
            <div className="mt-2">
              <span className="text-gray-500">Keywords:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedNode.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selectedNode.url && (
            <div className="mt-2">
              <a
                href={selectedNode.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                View Document →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
