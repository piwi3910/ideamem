import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

export interface SearchResultVisualization {
  id: string;
  title: string;
  content: string;
  summary?: string;
  url: string;

  // Core metadata
  metadata: {
    contentType: string;
    language?: string;
    complexity: string;
    wordCount: number;
    freshness: number;
    popularity: number;
    sourceType: string;
    repository?: string;
    lastUpdated: Date;
  };

  // Relevance scoring breakdown
  scores: {
    semantic: number; // Semantic similarity (0-1)
    keyword: number; // Keyword matching (0-1)
    popularity: number; // Popularity boost (0-1)
    freshness: number; // Freshness boost (0-1)
    quality: number; // Content quality (0-1)
    contextual: number; // Contextual relevance (0-1)
    combined: number; // Final combined score (0-1)
    rank: number; // Result rank (1-based)
  };

  // Visual scoring components
  visualization: {
    scoreBreakdown: ScoreComponent[];
    relevanceFactors: RelevanceFactor[];
    confidenceLevel: 'high' | 'medium' | 'low';
    explanations: ScoreExplanation[];
    improvements: SuggestionItem[];
  };

  // Contextual information
  context: {
    matchedTerms: string[];
    keyPhrases: string[];
    topicRelevance: number;
    documentCluster?: string;
    similarDocuments: string[];
  };
}

export interface ScoreComponent {
  name: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  color: string;
  explanation: string;
  icon: string;
}

export interface RelevanceFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  strength: number;
  description: string;
}

export interface ScoreExplanation {
  type: 'strength' | 'weakness' | 'neutral';
  title: string;
  description: string;
  score: number;
  suggestions?: string[];
}

export interface SuggestionItem {
  type: 'query' | 'filter' | 'related';
  action: string;
  description: string;
  impact: string;
}

export interface VisualizationSettings {
  showScoreBreakdown: boolean;
  showRelevanceFactors: boolean;
  showConfidenceIndicators: boolean;
  showImprovementSuggestions: boolean;
  groupByScore: boolean;
  highlightKeywords: boolean;
  showSimilarityHeatmap: boolean;
}

export class SearchVisualizationEngine {
  // Generate comprehensive visualization data for search results
  static async generateSearchVisualization(
    results: any[],
    query: string,
    searchType: 'semantic' | 'keyword' | 'hybrid' = 'hybrid',
    settings: VisualizationSettings = this.getDefaultSettings()
  ): Promise<SearchResultVisualization[]> {
    try {
      console.log('Generating search visualization for', results.length, 'results');

      const visualizedResults: SearchResultVisualization[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const visualization = await this.createResultVisualization(
          result,
          query,
          i + 1,
          searchType,
          results,
          settings
        );
        visualizedResults.push(visualization);
      }

      // Post-process for relative comparisons
      this.enhanceWithComparativeData(visualizedResults);

      return visualizedResults;
    } catch (error) {
      console.error('Error generating search visualization:', error);
      throw new Error('Failed to generate search visualization');
    }
  }

  // Create detailed visualization for a single search result
  private static async createResultVisualization(
    result: any,
    query: string,
    rank: number,
    searchType: string,
    allResults: any[],
    settings: VisualizationSettings
  ): Promise<SearchResultVisualization> {
    // Extract core scores
    const scores = {
      semantic: result.scores?.semantic || 0,
      keyword: result.scores?.keyword || 0,
      popularity: result.scores?.popularity || 0,
      freshness: result.scores?.freshness || 0,
      quality: this.calculateQualityScore(result),
      contextual: this.calculateContextualScore(result, query),
      combined: result.scores?.combined || 0,
      rank,
    };

    // Generate score breakdown components
    const scoreBreakdown = this.generateScoreBreakdown(scores, searchType);

    // Analyze relevance factors
    const relevanceFactors = this.analyzeRelevanceFactors(result, query, scores);

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(scores);

    // Generate explanations
    const explanations = this.generateScoreExplanations(result, query, scores);

    // Generate improvement suggestions
    const improvements = this.generateImprovementSuggestions(result, query, scores);

    // Extract contextual information
    const context = await this.extractContextualInfo(result, query, allResults);

    return {
      id: result.id,
      title: result.title || result.summary?.substring(0, 100) || 'Untitled',
      content: result.content || '',
      summary: result.summary,
      url: result.source?.url || result.metadata?.url || '',

      metadata: {
        contentType: result.metadata?.contentType || 'unknown',
        language: result.metadata?.language,
        complexity: result.metadata?.complexity || 'intermediate',
        wordCount: result.metadata?.wordCount || 0,
        freshness: result.metadata?.freshness || 0,
        popularity: result.metadata?.popularity || 0,
        sourceType: result.metadata?.sourceType || 'unknown',
        repository: this.extractRepository(result.source?.url || ''),
        lastUpdated: new Date(result.metadata?.lastUpdated || Date.now()),
      },

      scores,

      visualization: {
        scoreBreakdown,
        relevanceFactors,
        confidenceLevel,
        explanations,
        improvements,
      },

      context,
    };
  }

  // Generate detailed score breakdown with visual components
  private static generateScoreBreakdown(scores: any, searchType: string): ScoreComponent[] {
    const components: ScoreComponent[] = [];

    // Semantic similarity component
    if (searchType === 'semantic' || searchType === 'hybrid') {
      components.push({
        name: 'semantic',
        label: 'Semantic Match',
        value: scores.semantic,
        weight: searchType === 'semantic' ? 0.8 : 0.4,
        contribution: scores.semantic * (searchType === 'semantic' ? 0.8 : 0.4),
        color: '#3b82f6',
        explanation: 'How well the content matches the conceptual meaning of your query',
        icon: 'brain',
      });
    }

    // Keyword matching component
    if (searchType === 'keyword' || searchType === 'hybrid') {
      components.push({
        name: 'keyword',
        label: 'Keyword Match',
        value: scores.keyword,
        weight: searchType === 'keyword' ? 0.8 : 0.3,
        contribution: scores.keyword * (searchType === 'keyword' ? 0.8 : 0.3),
        color: '#10b981',
        explanation: 'Direct matches of your search terms in the content',
        icon: 'magnifying-glass',
      });
    }

    // Popularity component
    components.push({
      name: 'popularity',
      label: 'Popularity',
      value: scores.popularity,
      weight: 0.15,
      contribution: scores.popularity * 0.15,
      color: '#f59e0b',
      explanation: 'How frequently this content is accessed and referenced',
      icon: 'star',
    });

    // Freshness component
    components.push({
      name: 'freshness',
      label: 'Freshness',
      value: scores.freshness,
      weight: 0.1,
      contribution: scores.freshness * 0.1,
      color: '#06b6d4',
      explanation: 'How recently this content was updated or published',
      icon: 'clock',
    });

    // Quality component
    components.push({
      name: 'quality',
      label: 'Content Quality',
      value: scores.quality,
      weight: 0.1,
      contribution: scores.quality * 0.1,
      color: '#8b5cf6',
      explanation: 'Overall quality based on structure, completeness, and examples',
      icon: 'academic-cap',
    });

    // Contextual relevance
    components.push({
      name: 'contextual',
      label: 'Context',
      value: scores.contextual,
      weight: 0.05,
      contribution: scores.contextual * 0.05,
      color: '#ec4899',
      explanation: 'Relevance within the broader context of your search',
      icon: 'link',
    });

    return components;
  }

  // Analyze factors that affect relevance
  private static analyzeRelevanceFactors(
    result: any,
    query: string,
    scores: any
  ): RelevanceFactor[] {
    const factors: RelevanceFactor[] = [];

    // High semantic match
    if (scores.semantic > 0.8) {
      factors.push({
        factor: 'High Semantic Match',
        impact: 'positive',
        strength: scores.semantic,
        description: 'Content closely matches the conceptual meaning of your query',
      });
    }

    // Direct keyword matches
    if (scores.keyword > 0.7) {
      factors.push({
        factor: 'Strong Keyword Match',
        impact: 'positive',
        strength: scores.keyword,
        description: 'Multiple search terms found directly in the content',
      });
    }

    // Popular content
    if (scores.popularity > 0.6) {
      factors.push({
        factor: 'Popular Content',
        impact: 'positive',
        strength: scores.popularity,
        description: 'Frequently accessed content, indicating high value',
      });
    }

    // Recent content
    if (scores.freshness > 0.8) {
      factors.push({
        factor: 'Recent Content',
        impact: 'positive',
        strength: scores.freshness,
        description: 'Recently updated, likely to have current information',
      });
    }

    // Low quality indicators
    if (scores.quality < 0.3) {
      factors.push({
        factor: 'Quality Concerns',
        impact: 'negative',
        strength: 1 - scores.quality,
        description: 'Content may be incomplete or lack proper structure',
      });
    }

    // Content type relevance
    const contentType = result.metadata?.contentType || '';
    if (['tutorial', 'guide'].includes(contentType)) {
      factors.push({
        factor: 'Tutorial Content',
        impact: 'positive',
        strength: 0.7,
        description: 'Educational content that provides step-by-step guidance',
      });
    }

    return factors;
  }

  // Determine overall confidence level
  private static determineConfidenceLevel(scores: any): 'high' | 'medium' | 'low' {
    const avgScore = (scores.semantic + scores.keyword + scores.quality) / 3;

    if (avgScore > 0.8 && scores.combined > 0.7) return 'high';
    if (avgScore > 0.5 && scores.combined > 0.4) return 'medium';
    return 'low';
  }

  // Generate explanations for why results scored as they did
  private static generateScoreExplanations(
    result: any,
    query: string,
    scores: any
  ): ScoreExplanation[] {
    const explanations: ScoreExplanation[] = [];

    // Strong match explanation
    if (scores.combined > 0.8) {
      explanations.push({
        type: 'strength',
        title: 'Excellent Match',
        description: 'This result highly relevant to your query across multiple factors',
        score: scores.combined,
        suggestions: ["This appears to be exactly what you're looking for"],
      });
    }

    // Semantic strength
    if (scores.semantic > 0.7) {
      explanations.push({
        type: 'strength',
        title: 'Strong Conceptual Match',
        description: 'The content closely aligns with the meaning and intent of your search',
        score: scores.semantic,
      });
    }

    // Keyword weakness
    if (scores.keyword < 0.3 && scores.semantic > 0.6) {
      explanations.push({
        type: 'neutral',
        title: 'Indirect Match',
        description: "Conceptually relevant but doesn't use your exact search terms",
        score: scores.keyword,
        suggestions: [
          'Try searching with different keywords',
          'This content may use alternative terminology',
        ],
      });
    }

    // Quality issues
    if (scores.quality < 0.4) {
      explanations.push({
        type: 'weakness',
        title: 'Content Quality',
        description: 'This content may be incomplete, outdated, or poorly structured',
        score: scores.quality,
        suggestions: ['Look for more comprehensive resources', 'Check the publication date'],
      });
    }

    // Popularity factor
    if (scores.popularity > 0.8) {
      explanations.push({
        type: 'strength',
        title: 'Community Favorite',
        description: 'This content is frequently accessed and valued by the community',
        score: scores.popularity,
      });
    }

    return explanations;
  }

  // Generate suggestions for improving search results
  private static generateImprovementSuggestions(
    result: any,
    query: string,
    scores: any
  ): SuggestionItem[] {
    const suggestions: SuggestionItem[] = [];

    // Low semantic match suggestions
    if (scores.semantic < 0.4) {
      suggestions.push({
        type: 'query',
        action: 'Refine your search query',
        description: 'Try using more specific or alternative terms',
        impact: 'May find more relevant results',
      });
    }

    // Low keyword match suggestions
    if (scores.keyword < 0.3) {
      suggestions.push({
        type: 'query',
        action: 'Add related keywords',
        description: 'Include synonyms or related terms in your search',
        impact: 'Improve keyword matching',
      });
    }

    // Content type suggestions
    const contentType = result.metadata?.contentType;
    if (contentType && contentType !== 'tutorial' && query.includes('how to')) {
      suggestions.push({
        type: 'filter',
        action: 'Filter for tutorials',
        description: 'Focus on tutorial content for step-by-step guidance',
        impact: 'Find more instructional content',
      });
    }

    // Related content suggestions
    suggestions.push({
      type: 'related',
      action: 'Explore related documents',
      description: 'Find similar content using document relationships',
      impact: 'Discover additional relevant resources',
    });

    return suggestions;
  }

  // Extract contextual information about the result
  private static async extractContextualInfo(
    result: any,
    query: string,
    allResults: any[]
  ): Promise<any> {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Find matched terms in content
    const content = (result.content || '').toLowerCase();
    const matchedTerms = queryTerms.filter((term) => content.includes(term));

    // Extract key phrases (simplified approach)
    const keyPhrases = this.extractKeyPhrases(result.content || '', 5);

    // Calculate topic relevance
    const topicRelevance = matchedTerms.length / queryTerms.length;

    // Find similar documents (by score similarity)
    const similarDocuments = allResults
      .filter((r) => r.id !== result.id)
      .filter((r) => Math.abs(r.scores?.combined - result.scores?.combined) < 0.2)
      .slice(0, 3)
      .map((r) => r.id);

    return {
      matchedTerms,
      keyPhrases,
      topicRelevance,
      documentCluster: this.determineDocumentCluster(result),
      similarDocuments,
    };
  }

  // Helper methods
  private static calculateQualityScore(result: any): number {
    let score = 0.5; // Base score

    // Word count factor
    const wordCount = result.metadata?.wordCount || 0;
    if (wordCount > 100) score += 0.2;
    if (wordCount > 500) score += 0.1;
    if (wordCount > 1000) score += 0.1;

    // Structure indicators
    const content = result.content || '';
    if (content.includes('```')) score += 0.1; // Has code examples
    if (content.includes('# ') || content.includes('## ')) score += 0.1; // Has headers

    // Content type quality
    const contentType = result.metadata?.contentType || '';
    if (['tutorial', 'guide', 'api'].includes(contentType)) score += 0.1;

    return Math.min(score, 1.0);
  }

  private static calculateContextualScore(result: any, query: string): number {
    // Simplified contextual scoring based on query-content alignment
    const queryTerms = query.toLowerCase().split(/\s+/);
    const content = (result.content || '').toLowerCase();
    const title = (result.title || '').toLowerCase();

    let score = 0;
    let termCount = 0;

    queryTerms.forEach((term) => {
      if (term.length > 2) {
        termCount++;
        if (title.includes(term)) score += 0.4;
        else if (content.includes(term)) score += 0.2;
      }
    });

    return termCount > 0 ? score / termCount : 0;
  }

  private static extractKeyPhrases(content: string, limit: number = 5): string[] {
    // Simple key phrase extraction
    const sentences = content.split(/[.!?]+/);
    const phrases = sentences
      .filter((s) => s.length > 20 && s.length < 100)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, limit);

    return phrases;
  }

  private static extractRepository(url: string): string | undefined {
    const patterns = [
      /github\.com\/([^\/]+\/[^\/]+)/,
      /gitlab\.com\/([^\/]+\/[^\/]+)/,
      /bitbucket\.org\/([^\/]+\/[^\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  private static determineDocumentCluster(result: any): string {
    const contentType = result.metadata?.contentType || '';
    const language = result.metadata?.language || '';

    if (contentType === 'api') return 'API Reference';
    if (contentType === 'tutorial') return 'Tutorials';
    if (language) return `${language} Documentation`;
    return 'General Documentation';
  }

  private static enhanceWithComparativeData(results: SearchResultVisualization[]): void {
    // Add relative rankings and percentile scores
    results.forEach((result, index) => {
      result.scores.rank = index + 1;

      // Calculate percentiles for each score component
      result.visualization.scoreBreakdown.forEach((component) => {
        const values = results.map(
          (r) => r.visualization.scoreBreakdown.find((c) => c.name === component.name)?.value || 0
        );
        values.sort((a, b) => b - a);
        const percentile = (values.indexOf(component.value) / values.length) * 100;
        (component as any).percentile = Math.round(percentile);
      });
    });
  }

  private static getDefaultSettings(): VisualizationSettings {
    return {
      showScoreBreakdown: true,
      showRelevanceFactors: true,
      showConfidenceIndicators: true,
      showImprovementSuggestions: true,
      groupByScore: false,
      highlightKeywords: true,
      showSimilarityHeatmap: false,
    };
  }

  // Generate visualization summary statistics
  static generateVisualizationSummary(results: SearchResultVisualization[]): any {
    if (results.length === 0) return null;

    const avgCombinedScore =
      results.reduce((sum, r) => sum + r.scores.combined, 0) / results.length;
    const topScore = results[0]?.scores.combined || 0;
    const scoreRange = topScore - (results[results.length - 1]?.scores.combined || 0);

    const confidenceLevels = {
      high: results.filter((r) => r.visualization.confidenceLevel === 'high').length,
      medium: results.filter((r) => r.visualization.confidenceLevel === 'medium').length,
      low: results.filter((r) => r.visualization.confidenceLevel === 'low').length,
    };

    const topFactors = this.getTopRelevanceFactors(results);

    return {
      totalResults: results.length,
      averageScore: avgCombinedScore,
      topScore,
      scoreRange,
      confidenceLevels,
      topFactors,
      searchQuality: this.assessSearchQuality(results),
    };
  }

  private static getTopRelevanceFactors(results: SearchResultVisualization[]): any[] {
    const factorCounts = new Map<string, number>();

    results.forEach((result) => {
      result.visualization.relevanceFactors.forEach((factor) => {
        factorCounts.set(factor.factor, (factorCounts.get(factor.factor) || 0) + 1);
      });
    });

    return Array.from(factorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count, percentage: (count / results.length) * 100 }));
  }

  private static assessSearchQuality(results: SearchResultVisualization[]): string {
    if (results.length === 0) return 'no-results';

    const avgScore = results.reduce((sum, r) => sum + r.scores.combined, 0) / results.length;
    const highConfidenceCount = results.filter(
      (r) => r.visualization.confidenceLevel === 'high'
    ).length;
    const highConfidenceRatio = highConfidenceCount / results.length;

    if (avgScore > 0.8 && highConfidenceRatio > 0.5) return 'excellent';
    if (avgScore > 0.6 && highConfidenceRatio > 0.3) return 'good';
    if (avgScore > 0.4) return 'moderate';
    return 'poor';
  }
}
