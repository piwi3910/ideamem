import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

export interface DocumentNode {
  id: string;
  title: string;
  url: string;
  contentType: string;
  language?: string;
  complexity: string;
  popularity: number;
  size: number;
  lastUpdated: Date;
  keywords: string[];
  category: string;
}

export interface DocumentRelationship {
  sourceId: string;
  targetId: string;
  relationshipType: 'references' | 'imports' | 'links_to' | 'builds_on' | 'similar_to' | 'extends';
  strength: number; // 0.0 to 1.0
  bidirectional: boolean;
  context?: string;
}

export interface DocumentGraph {
  nodes: DocumentNode[];
  relationships: DocumentRelationship[];
  clusters: DocumentCluster[];
  metrics: GraphMetrics;
}

export interface DocumentCluster {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  color: string;
  category: 'topic' | 'language' | 'complexity' | 'usage';
}

export interface GraphMetrics {
  totalNodes: number;
  totalRelationships: number;
  density: number;
  avgConnections: number;
  topConnectedNodes: Array<{ nodeId: string; connections: number; title: string }>;
  strongestRelationships: Array<{
    sourceTitle: string;
    targetTitle: string;
    strength: number;
    type: string;
  }>;
}

export class RelationshipAnalyzer {
  // Build comprehensive documentation graph
  static async buildDocumentationGraph(
    projectId?: string,
    options: {
      includeWeakRelationships?: boolean;
      minStrength?: number;
      maxNodes?: number;
    } = {}
  ): Promise<DocumentGraph> {
    const { includeWeakRelationships = false, minStrength = 0.3, maxNodes = 200 } = options;

    try {
      // Get all indexed content
      const searchIndex = await prisma.searchIndex.findMany({
        where: projectId ? { sourceUrl: { contains: projectId } } : {},
        take: maxNodes,
        orderBy: { popularity: 'desc' },
      });

      // Convert to nodes
      const nodes: DocumentNode[] = searchIndex.map((item) => ({
        id: item.id,
        title: item.title || item.summary?.substring(0, 100) || 'Untitled',
        url: item.sourceUrl || '',
        contentType: item.contentType || 'unknown',
        language: item.language || undefined,
        complexity: item.complexity || 'intermediate',
        popularity: item.popularity || 0,
        size: item.content?.length || 0,
        lastUpdated: item.updatedAt || item.createdAt,
        keywords: item.content ? this.extractKeywordsFromContent(item.content) : [],
        category: this.categorizeContent(item),
      }));

      // Analyze relationships between all nodes
      const relationships: DocumentRelationship[] = [];

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const sourceNode = nodes[i];
          const targetNode = nodes[j];
          const sourceContent = searchIndex[i];
          const targetContent = searchIndex[j];

          const relationship = await this.analyzeRelationship(
            sourceContent,
            targetContent,
            sourceNode,
            targetNode
          );

          if (relationship && (includeWeakRelationships || relationship.strength >= minStrength)) {
            relationships.push(relationship);
          }
        }
      }

      // Create clusters based on content similarity and relationships
      const clusters = await this.createDocumentClusters(nodes, relationships);

      // Calculate graph metrics
      const metrics = this.calculateGraphMetrics(nodes, relationships);

      return {
        nodes,
        relationships,
        clusters,
        metrics,
      };
    } catch (error) {
      console.error('Error building documentation graph:', error);
      throw new Error('Failed to build documentation graph');
    }
  }

  // Analyze relationship between two documents
  private static async analyzeRelationship(
    sourceContent: any,
    targetContent: any,
    sourceNode: DocumentNode,
    targetNode: DocumentNode
  ): Promise<DocumentRelationship | null> {
    let relationshipType: DocumentRelationship['relationshipType'] = 'similar_to';
    let strength = 0;
    let bidirectional = true;
    let context = '';

    // Check for direct references in content
    const sourceText = sourceContent.content?.toLowerCase() || '';
    const targetText = targetContent.content?.toLowerCase() || '';
    const sourceTitle = sourceNode.title.toLowerCase();
    const targetTitle = targetNode.title.toLowerCase();

    // Direct title mentions
    if (sourceText.includes(targetTitle) || targetText.includes(sourceTitle)) {
      relationshipType = 'references';
      strength += 0.4;
      context = 'Direct title reference found';
      bidirectional = sourceText.includes(targetTitle) && targetText.includes(sourceTitle);
    }

    // URL/import references
    if (sourceText.includes(targetNode.url) || targetText.includes(sourceNode.url)) {
      relationshipType = 'links_to';
      strength += 0.3;
      context = 'URL reference found';
    }

    // Code imports (for programming content)
    if (sourceNode.contentType === 'code' || targetNode.contentType === 'code') {
      const importStrength = this.analyzeCodeImports(
        sourceText,
        targetText,
        sourceNode,
        targetNode
      );
      if (importStrength > 0) {
        relationshipType = 'imports';
        strength += importStrength;
        context = 'Code import relationship detected';
      }
    }

    // Keyword similarity
    const keywordSimilarity = this.calculateKeywordSimilarity(
      sourceNode.keywords,
      targetNode.keywords
    );
    if (keywordSimilarity > 0.3) {
      strength += keywordSimilarity * 0.3;
      if (strength === keywordSimilarity * 0.3) {
        context = `Similar keywords: ${keywordSimilarity.toFixed(2)} similarity`;
      }
    }

    // Content type and language similarity
    if (sourceNode.contentType === targetNode.contentType) {
      strength += 0.1;
    }
    if (sourceNode.language === targetNode.language && sourceNode.language) {
      strength += 0.1;
    }

    // Complexity relationship (beginner -> intermediate -> advanced)
    const complexityRelation = this.analyzeComplexityRelationship(
      sourceNode.complexity,
      targetNode.complexity
    );
    if (complexityRelation.strength > 0) {
      relationshipType = 'builds_on';
      strength += complexityRelation.strength;
      context = complexityRelation.context;
      bidirectional = false;
    }

    // Only return relationships with meaningful strength
    if (strength < 0.2) {
      return null;
    }

    return {
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      relationshipType,
      strength: Math.min(strength, 1.0),
      bidirectional,
      context,
    };
  }

  // Analyze code import relationships
  private static analyzeCodeImports(
    sourceText: string,
    targetText: string,
    sourceNode: DocumentNode,
    targetNode: DocumentNode
  ): number {
    let strength = 0;

    // Common import patterns
    const importPatterns = [
      /import.*from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /#include\s*<([^>]+)>/g,
      /#import\s*['"]([^'"]+)['"]/g,
    ];

    for (const pattern of importPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(sourceText)) !== null) {
        const importPath = match[1];
        if (targetNode.url.includes(importPath) || targetNode.title.includes(importPath)) {
          strength += 0.4;
          break;
        }
      }
    }

    return Math.min(strength, 0.8);
  }

  // Calculate keyword similarity using Jaccard index
  private static calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
    const set2 = new Set(keywords2.map((k) => k.toLowerCase()));

    const intersection = new Set(Array.from(set1).filter((k) => set2.has(k)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);

    return intersection.size / union.size;
  }

  // Analyze complexity relationships (beginner builds to intermediate, etc.)
  private static analyzeComplexityRelationship(
    sourceComplexity: string,
    targetComplexity: string
  ): { strength: number; context: string } {
    const complexityLevels: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    const sourceLevel = complexityLevels[sourceComplexity] || 2;
    const targetLevel = complexityLevels[targetComplexity] || 2;

    if (targetLevel === sourceLevel + 1) {
      return {
        strength: 0.3,
        context: `${sourceComplexity} content builds to ${targetComplexity}`,
      };
    }

    return { strength: 0, context: '' };
  }

  // Create document clusters based on content similarity
  private static async createDocumentClusters(
    nodes: DocumentNode[],
    relationships: DocumentRelationship[]
  ): Promise<DocumentCluster[]> {
    const clusters: DocumentCluster[] = [];

    // Language-based clusters
    const languageGroups = new Map<string, DocumentNode[]>();
    nodes.forEach((node) => {
      if (node.language) {
        if (!languageGroups.has(node.language)) {
          languageGroups.set(node.language, []);
        }
        languageGroups.get(node.language)!.push(node);
      }
    });

    languageGroups.forEach((nodeList, language) => {
      if (nodeList.length >= 2) {
        clusters.push({
          id: `lang-${language}`,
          name: `${language.charAt(0).toUpperCase() + language.slice(1)} Documentation`,
          description: `All documentation related to ${language}`,
          nodeIds: nodeList.map((n) => n.id),
          color: this.getLanguageColor(language),
          category: 'language',
        });
      }
    });

    // Content type clusters
    const typeGroups = new Map<string, DocumentNode[]>();
    nodes.forEach((node) => {
      if (!typeGroups.has(node.contentType)) {
        typeGroups.set(node.contentType, []);
      }
      typeGroups.get(node.contentType)!.push(node);
    });

    typeGroups.forEach((nodeList, type) => {
      if (nodeList.length >= 3) {
        clusters.push({
          id: `type-${type}`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Resources`,
          description: `All ${type} documentation and resources`,
          nodeIds: nodeList.map((n) => n.id),
          color: this.getTypeColor(type),
          category: 'topic',
        });
      }
    });

    // Highly connected clusters (based on relationships)
    const connectionCounts = new Map<string, number>();
    relationships.forEach((rel) => {
      connectionCounts.set(rel.sourceId, (connectionCounts.get(rel.sourceId) || 0) + 1);
      connectionCounts.set(rel.targetId, (connectionCounts.get(rel.targetId) || 0) + 1);
    });

    const highlyConnected = nodes.filter((node) => (connectionCounts.get(node.id) || 0) >= 5);
    if (highlyConnected.length >= 3) {
      clusters.push({
        id: 'highly-connected',
        name: 'Core Documentation',
        description: 'Frequently referenced and interconnected documents',
        nodeIds: highlyConnected.map((n) => n.id),
        color: '#ff6b6b',
        category: 'usage',
      });
    }

    return clusters;
  }

  // Calculate comprehensive graph metrics
  private static calculateGraphMetrics(
    nodes: DocumentNode[],
    relationships: DocumentRelationship[]
  ): GraphMetrics {
    const totalNodes = nodes.length;
    const totalRelationships = relationships.length;
    const maxPossibleRelationships = (totalNodes * (totalNodes - 1)) / 2;
    const density =
      maxPossibleRelationships > 0 ? totalRelationships / maxPossibleRelationships : 0;

    // Calculate connection counts
    const connectionCounts = new Map<string, number>();
    relationships.forEach((rel) => {
      connectionCounts.set(rel.sourceId, (connectionCounts.get(rel.sourceId) || 0) + 1);
      connectionCounts.set(rel.targetId, (connectionCounts.get(rel.targetId) || 0) + 1);
    });

    const avgConnections = totalNodes > 0 ? (totalRelationships * 2) / totalNodes : 0;

    // Top connected nodes
    const nodeConnectionPairs = Array.from(connectionCounts.entries())
      .map(([nodeId, connections]) => ({
        nodeId,
        connections,
        title: nodes.find((n) => n.id === nodeId)?.title || 'Unknown',
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);

    // Strongest relationships
    const strongestRelationships = relationships
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10)
      .map((rel) => ({
        sourceTitle: nodes.find((n) => n.id === rel.sourceId)?.title || 'Unknown',
        targetTitle: nodes.find((n) => n.id === rel.targetId)?.title || 'Unknown',
        strength: rel.strength,
        type: rel.relationshipType,
      }));

    return {
      totalNodes,
      totalRelationships,
      density,
      avgConnections,
      topConnectedNodes: nodeConnectionPairs,
      strongestRelationships,
    };
  }

  // Categorize content based on metadata
  private static categorizeContent(item: any): string {
    const contentType = item.contentType || '';
    const title = item.title?.toLowerCase() || '';

    if (contentType === 'api') return 'API Reference';
    if (contentType === 'tutorial') return 'Tutorial';
    if (contentType === 'guide') return 'Guide';
    if (contentType === 'example') return 'Example';
    if (title.includes('getting started') || title.includes('introduction'))
      return 'Getting Started';
    if (title.includes('advanced') || title.includes('optimization')) return 'Advanced';

    return 'Documentation';
  }

  // Extract keywords from content
  private static extractKeywordsFromContent(content: string): string[] {
    // Simple keyword extraction - in a real implementation would use more sophisticated NLP
    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
      .split(/\s+/)
      .filter((word) => word.length > 3) // Filter short words
      .filter((word) => !this.isStopWord(word)) // Filter stop words
      .slice(0, 10); // Take top 10

    // Remove duplicates and return
    return Array.from(new Set(words));
  }

  // Check if word is a stop word
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'this',
      'that',
      'with',
      'have',
      'will',
      'been',
      'from',
      'they',
      'know',
      'want',
      'been',
      'good',
      'much',
      'some',
      'time',
      'very',
      'when',
      'come',
      'here',
      'just',
      'like',
      'long',
      'make',
      'many',
      'over',
      'such',
      'take',
      'than',
      'them',
      'well',
      'were',
      'what',
      'where',
      'who',
      'would',
      'there',
      'each',
      'which',
      'their',
      'said',
      'get',
      'may',
      'had',
      'has',
      'his',
      'her',
      'him',
      'how',
      'man',
      'new',
      'now',
      'old',
      'see',
      'two',
      'way',
      'who',
      'boy',
      'did',
      'its',
      'let',
      'put',
      'say',
      'she',
      'too',
      'use',
      'and',
      'the',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'was',
      'one',
      'our',
      'out',
      'day',
      'get',
      'use',
      'man',
      'new',
      'now',
      'way',
      'may',
      'say',
    ]);
    return stopWords.has(word);
  }

  // Get color for programming languages
  private static getLanguageColor(language: string): string {
    const colors: Record<string, string> = {
      javascript: '#f7df1e',
      typescript: '#3178c6',
      python: '#3776ab',
      java: '#ed8b00',
      go: '#00add8',
      rust: '#dea584',
      php: '#777bb4',
      ruby: '#cc342d',
      swift: '#fa7343',
      kotlin: '#7f52ff',
      css: '#1572b6',
      html: '#e34f26',
      sql: '#336791',
    };
    return colors[language.toLowerCase()] || '#6c757d';
  }

  // Get color for content types
  private static getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      api: '#e74c3c',
      tutorial: '#2ecc71',
      guide: '#3498db',
      example: '#f39c12',
      reference: '#9b59b6',
      documentation: '#34495e',
    };
    return colors[type.toLowerCase()] || '#95a5a6';
  }

  // Get related documents for a specific document
  static async getRelatedDocuments(
    documentId: string,
    limit: number = 10,
    minStrength: number = 0.3
  ): Promise<Array<{ document: DocumentNode; relationship: DocumentRelationship }>> {
    try {
      // This would ideally use stored relationships, but for now we'll calculate on demand
      const searchIndex = await prisma.searchIndex.findMany({
        take: 50,
        orderBy: { popularity: 'desc' },
      });

      const targetDoc = searchIndex.find((doc) => doc.id === documentId);
      if (!targetDoc) {
        return [];
      }

      const targetNode: DocumentNode = {
        id: targetDoc.id,
        title: targetDoc.title || 'Untitled',
        url: targetDoc.sourceUrl || '',
        contentType: targetDoc.contentType || 'unknown',
        language: targetDoc.language || undefined,
        complexity: targetDoc.complexity || 'intermediate',
        popularity: targetDoc.popularity || 0,
        size: targetDoc.content?.length || 0,
        lastUpdated: targetDoc.updatedAt || targetDoc.createdAt,
        keywords: targetDoc.content ? this.extractKeywordsFromContent(targetDoc.content) : [],
        category: this.categorizeContent(targetDoc),
      };

      const relatedDocs: Array<{ document: DocumentNode; relationship: DocumentRelationship }> = [];

      for (const doc of searchIndex) {
        if (doc.id === documentId) continue;

        const candidateNode: DocumentNode = {
          id: doc.id,
          title: doc.title || 'Untitled',
          url: doc.sourceUrl || '',
          contentType: doc.contentType || 'unknown',
          language: doc.language || undefined,
          complexity: doc.complexity || 'intermediate',
          popularity: doc.popularity || 0,
          size: doc.content?.length || 0,
          lastUpdated: doc.updatedAt || doc.createdAt,
          keywords: doc.content ? this.extractKeywordsFromContent(doc.content) : [],
          category: this.categorizeContent(doc),
        };

        const relationship = await this.analyzeRelationship(
          targetDoc,
          doc,
          targetNode,
          candidateNode
        );

        if (relationship && relationship.strength >= minStrength) {
          relatedDocs.push({
            document: candidateNode,
            relationship,
          });
        }
      }

      return relatedDocs
        .sort((a, b) => b.relationship.strength - a.relationship.strength)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting related documents:', error);
      return [];
    }
  }
}
