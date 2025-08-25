import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

export interface SearchFacet {
  key: string;
  name: string;
  type: 'checkbox' | 'range' | 'select' | 'tags' | 'date_range' | 'boolean';
  values: FacetValue[];
  selectedValues?: any[];
  min?: number;
  max?: number;
  step?: number;
}

export interface FacetValue {
  value: string | number | boolean;
  label: string;
  count: number;
  percentage?: number;
  selected?: boolean;
}

export interface FacetFilters {
  contentTypes?: string[];
  languages?: string[];
  complexity?: string[];
  sourceTypes?: string[];
  freshnessRange?: { min: number; max: number };
  popularityRange?: { min: number; max: number };
  wordCountRange?: { min: number; max: number };
  hasExamples?: boolean;
  dateRange?: { start: Date; end: Date };
  repositories?: string[];
  tags?: string[];
}

export interface FacetAnalysis {
  facets: SearchFacet[];
  totalDocuments: number;
  filteredDocuments: number;
  appliedFilters: FacetFilters;
  suggestions: FilterSuggestion[];
}

export interface FilterSuggestion {
  type: 'add' | 'remove' | 'refine';
  facetKey: string;
  value: any;
  label: string;
  reason: string;
  impact: number; // Number of documents this would add/remove
}

export class SearchFacetsEngine {
  // Generate dynamic facets based on current search results and query
  static async generateFacets(
    query?: string,
    currentFilters: FacetFilters = {},
    projectId?: string
  ): Promise<FacetAnalysis> {
    try {
      console.log('Generating search facets for:', query, currentFilters);

      // Get base dataset (apply existing filters except the ones we're analyzing)
      const whereClause = this.buildWhereClause(currentFilters, projectId);

      const allDocuments = await prisma.searchIndex.findMany({
        where: whereClause,
        select: {
          id: true,
          contentType: true,
          language: true,
          complexity: true,
          sourceType: true,
          sourceUrl: true,
          freshness: true,
          popularity: true,
          wordCount: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Generate facets
      const facets: SearchFacet[] = [
        await this.generateContentTypeFacet(allDocuments, currentFilters),
        await this.generateLanguageFacet(allDocuments, currentFilters),
        await this.generateComplexityFacet(allDocuments, currentFilters),
        await this.generateSourceTypeFacet(allDocuments, currentFilters),
        await this.generateRepositoryFacet(allDocuments, currentFilters),
        await this.generateFreshnessRangeFacet(allDocuments, currentFilters),
        await this.generatePopularityRangeFacet(allDocuments, currentFilters),
        await this.generateWordCountRangeFacet(allDocuments, currentFilters),
        await this.generateDateRangeFacet(allDocuments, currentFilters),
        await this.generateHasExamplesFacet(allDocuments, currentFilters),
        await this.generateTagsFacet(allDocuments, currentFilters, query),
      ];

      // Generate filter suggestions
      const suggestions = await this.generateFilterSuggestions(allDocuments, currentFilters, query);

      // Get total document count without filters
      const totalDocuments = await prisma.searchIndex.count({
        where: projectId ? { sourceUrl: { contains: projectId } } : {},
      });

      return {
        facets,
        totalDocuments,
        filteredDocuments: allDocuments.length,
        appliedFilters: currentFilters,
        suggestions,
      };
    } catch (error) {
      console.error('Error generating search facets:', error);
      throw new Error('Failed to generate search facets');
    }
  }

  // Generate content type facet (API, Tutorial, Guide, etc.)
  private static async generateContentTypeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const typeCounts = new Map<string, number>();

    documents.forEach((doc) => {
      const type = doc.contentType || 'other';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const values: FacetValue[] = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        value: type,
        label: this.formatContentTypeLabel(type),
        count,
        percentage: (count / documents.length) * 100,
        selected: currentFilters.contentTypes?.includes(type) || false,
      }));

    return {
      key: 'contentTypes',
      name: 'Content Type',
      type: 'checkbox',
      values,
      selectedValues: currentFilters.contentTypes || [],
    };
  }

  // Generate programming language facet
  private static async generateLanguageFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const languageCounts = new Map<string, number>();

    documents.forEach((doc) => {
      if (doc.language) {
        languageCounts.set(doc.language, (languageCounts.get(doc.language) || 0) + 1);
      }
    });

    const values: FacetValue[] = Array.from(languageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({
        value: language,
        label: this.formatLanguageLabel(language),
        count,
        percentage: (count / documents.length) * 100,
        selected: currentFilters.languages?.includes(language) || false,
      }));

    return {
      key: 'languages',
      name: 'Programming Language',
      type: 'checkbox',
      values,
      selectedValues: currentFilters.languages || [],
    };
  }

  // Generate complexity level facet
  private static async generateComplexityFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const complexityCounts = new Map<string, number>();
    const complexityOrder = ['beginner', 'intermediate', 'advanced'];

    documents.forEach((doc) => {
      const complexity = doc.complexity || 'intermediate';
      complexityCounts.set(complexity, (complexityCounts.get(complexity) || 0) + 1);
    });

    const values: FacetValue[] = complexityOrder
      .filter((level) => complexityCounts.has(level))
      .map((level) => ({
        value: level,
        label: level.charAt(0).toUpperCase() + level.slice(1),
        count: complexityCounts.get(level) || 0,
        percentage: ((complexityCounts.get(level) || 0) / documents.length) * 100,
        selected: currentFilters.complexity?.includes(level) || false,
      }));

    return {
      key: 'complexity',
      name: 'Difficulty Level',
      type: 'checkbox',
      values,
      selectedValues: currentFilters.complexity || [],
    };
  }

  // Generate source type facet (git, llmstxt, website)
  private static async generateSourceTypeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const sourceTypeCounts = new Map<string, number>();

    documents.forEach((doc) => {
      const sourceType = doc.sourceType || 'unknown';
      sourceTypeCounts.set(sourceType, (sourceTypeCounts.get(sourceType) || 0) + 1);
    });

    const values: FacetValue[] = Array.from(sourceTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sourceType, count]) => ({
        value: sourceType,
        label: this.formatSourceTypeLabel(sourceType),
        count,
        percentage: (count / documents.length) * 100,
        selected: currentFilters.sourceTypes?.includes(sourceType) || false,
      }));

    return {
      key: 'sourceTypes',
      name: 'Source Type',
      type: 'checkbox',
      values,
      selectedValues: currentFilters.sourceTypes || [],
    };
  }

  // Generate repository facet
  private static async generateRepositoryFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const repoCounts = new Map<string, number>();

    documents.forEach((doc) => {
      const repo = this.extractRepositoryName(doc.sourceUrl);
      if (repo) {
        repoCounts.set(repo, (repoCounts.get(repo) || 0) + 1);
      }
    });

    const values: FacetValue[] = Array.from(repoCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Top 20 repositories
      .map(([repo, count]) => ({
        value: repo,
        label: repo,
        count,
        percentage: (count / documents.length) * 100,
        selected: currentFilters.repositories?.includes(repo) || false,
      }));

    return {
      key: 'repositories',
      name: 'Repository',
      type: 'select',
      values,
      selectedValues: currentFilters.repositories || [],
    };
  }

  // Generate freshness range facet
  private static async generateFreshnessRangeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const freshnessValues = documents.map((doc) => doc.freshness || 0).filter((f) => f > 0);

    if (freshnessValues.length === 0) {
      return {
        key: 'freshnessRange',
        name: 'Content Freshness',
        type: 'range',
        values: [],
        min: 0,
        max: 1,
        step: 0.1,
      };
    }

    const min = Math.min(...freshnessValues);
    const max = Math.max(...freshnessValues);

    return {
      key: 'freshnessRange',
      name: 'Content Freshness',
      type: 'range',
      values: [
        {
          value: currentFilters.freshnessRange?.min || min,
          label: 'Min Freshness',
          count: 0,
        },
        {
          value: currentFilters.freshnessRange?.max || max,
          label: 'Max Freshness',
          count: 0,
        },
      ],
      min,
      max,
      step: 0.1,
      selectedValues: [
        currentFilters.freshnessRange?.min || min,
        currentFilters.freshnessRange?.max || max,
      ],
    };
  }

  // Generate popularity range facet
  private static async generatePopularityRangeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const popularityValues = documents.map((doc) => doc.popularity || 0).filter((p) => p >= 0);

    if (popularityValues.length === 0) {
      return {
        key: 'popularityRange',
        name: 'Popularity Score',
        type: 'range',
        values: [],
        min: 0,
        max: 100,
        step: 1,
      };
    }

    const min = Math.min(...popularityValues);
    const max = Math.max(...popularityValues);

    return {
      key: 'popularityRange',
      name: 'Popularity Score',
      type: 'range',
      values: [
        {
          value: currentFilters.popularityRange?.min || min,
          label: 'Min Popularity',
          count: 0,
        },
        {
          value: currentFilters.popularityRange?.max || max,
          label: 'Max Popularity',
          count: 0,
        },
      ],
      min,
      max,
      step: 1,
      selectedValues: [
        currentFilters.popularityRange?.min || min,
        currentFilters.popularityRange?.max || max,
      ],
    };
  }

  // Generate word count range facet
  private static async generateWordCountRangeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const wordCounts = documents.map((doc) => doc.wordCount || 0).filter((w) => w > 0);

    if (wordCounts.length === 0) {
      return {
        key: 'wordCountRange',
        name: 'Document Length',
        type: 'range',
        values: [],
        min: 0,
        max: 5000,
        step: 100,
      };
    }

    const min = Math.min(...wordCounts);
    const max = Math.max(...wordCounts);

    return {
      key: 'wordCountRange',
      name: 'Document Length (words)',
      type: 'range',
      values: [
        {
          value: currentFilters.wordCountRange?.min || min,
          label: 'Min Words',
          count: 0,
        },
        {
          value: currentFilters.wordCountRange?.max || max,
          label: 'Max Words',
          count: 0,
        },
      ],
      min,
      max,
      step: 100,
      selectedValues: [
        currentFilters.wordCountRange?.min || min,
        currentFilters.wordCountRange?.max || max,
      ],
    };
  }

  // Generate date range facet
  private static async generateDateRangeFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const dates = documents
      .map((doc) => doc.updatedAt || doc.createdAt)
      .filter((d) => d)
      .map((d) => new Date(d));

    if (dates.length === 0) {
      const now = new Date();
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      return {
        key: 'dateRange',
        name: 'Last Updated',
        type: 'date_range',
        values: [],
        selectedValues: [yearAgo, now],
      };
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    return {
      key: 'dateRange',
      name: 'Last Updated',
      type: 'date_range',
      values: [
        {
          value: (currentFilters.dateRange?.start || minDate).toISOString(),
          label: 'Start Date',
          count: 0,
        },
        {
          value: (currentFilters.dateRange?.end || maxDate).toISOString(),
          label: 'End Date',
          count: 0,
        },
      ],
      selectedValues: [
        (currentFilters.dateRange?.start || minDate).toISOString(),
        (currentFilters.dateRange?.end || maxDate).toISOString(),
      ],
    };
  }

  // Generate "has examples" boolean facet
  private static async generateHasExamplesFacet(
    documents: any[],
    currentFilters: FacetFilters
  ): Promise<SearchFacet> {
    const hasExamplesCount = documents.filter(
      (doc) =>
        doc.content?.toLowerCase().includes('example') ||
        doc.content?.toLowerCase().includes('demo') ||
        doc.content?.toLowerCase().includes('```') ||
        doc.contentType === 'example'
    ).length;

    const withoutExamplesCount = documents.length - hasExamplesCount;

    return {
      key: 'hasExamples',
      name: 'Contains Examples',
      type: 'boolean',
      values: [
        {
          value: true,
          label: 'Has Code Examples',
          count: hasExamplesCount,
          percentage: (hasExamplesCount / documents.length) * 100,
          selected: currentFilters.hasExamples === true,
        },
        {
          value: false,
          label: 'No Examples',
          count: withoutExamplesCount,
          percentage: (withoutExamplesCount / documents.length) * 100,
          selected: currentFilters.hasExamples === false,
        },
      ],
      selectedValues: currentFilters.hasExamples !== undefined ? [currentFilters.hasExamples] : [],
    };
  }

  // Generate dynamic tags facet based on content analysis
  private static async generateTagsFacet(
    documents: any[],
    currentFilters: FacetFilters,
    query?: string
  ): Promise<SearchFacet> {
    // Extract common terms and concepts from content
    const tagCounts = new Map<string, number>();
    const commonTerms = new Set([
      'api',
      'tutorial',
      'guide',
      'example',
      'documentation',
      'reference',
      'getting started',
      'advanced',
      'beginner',
      'configuration',
      'setup',
      'installation',
      'usage',
      'best practices',
      'troubleshooting',
      'faq',
    ]);

    documents.forEach((doc) => {
      const text = (doc.content || '').toLowerCase();
      const title = (doc.title || '').toLowerCase();

      commonTerms.forEach((term) => {
        if (text.includes(term) || title.includes(term)) {
          tagCounts.set(term, (tagCounts.get(term) || 0) + 1);
        }
      });

      // Add content type as tag
      if (doc.contentType) {
        tagCounts.set(doc.contentType, (tagCounts.get(doc.contentType) || 0) + 1);
      }
    });

    const values: FacetValue[] = Array.from(tagCounts.entries())
      .filter(([tag, count]) => count >= 2) // Only include tags with 2+ occurrences
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15) // Top 15 tags
      .map(([tag, count]) => ({
        value: tag,
        label: tag.charAt(0).toUpperCase() + tag.slice(1),
        count,
        percentage: (count / documents.length) * 100,
        selected: currentFilters.tags?.includes(tag) || false,
      }));

    return {
      key: 'tags',
      name: 'Topics & Tags',
      type: 'tags',
      values,
      selectedValues: currentFilters.tags || [],
    };
  }

  // Generate intelligent filter suggestions
  private static async generateFilterSuggestions(
    documents: any[],
    currentFilters: FacetFilters,
    query?: string
  ): Promise<FilterSuggestion[]> {
    const suggestions: FilterSuggestion[] = [];

    // Suggest popular content types if none selected
    if (!currentFilters.contentTypes || currentFilters.contentTypes.length === 0) {
      const popularTypes = this.getPopularContentTypes(documents);
      popularTypes.forEach((type) => {
        const impact = documents.filter((d) => d.contentType === type.value).length;
        if (impact > 5) {
          suggestions.push({
            type: 'add',
            facetKey: 'contentTypes',
            value: type.value,
            label: `Show ${type.label} content`,
            reason: `Found ${impact} ${type.label.toLowerCase()} documents`,
            impact,
          });
        }
      });
    }

    // Suggest complexity refinement
    if (query && this.isBeginnerQuery(query) && !currentFilters.complexity?.includes('beginner')) {
      const beginnerDocs = documents.filter((d) => d.complexity === 'beginner').length;
      if (beginnerDocs > 0) {
        suggestions.push({
          type: 'add',
          facetKey: 'complexity',
          value: 'beginner',
          label: 'Focus on beginner content',
          reason: 'Your query suggests you might prefer beginner-friendly content',
          impact: beginnerDocs,
        });
      }
    }

    // Suggest removing filters that severely limit results
    if (documents.length < 5 && Object.keys(currentFilters).length > 0) {
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          suggestions.push({
            type: 'remove',
            facetKey: key,
            value: null,
            label: `Remove ${key} filters`,
            reason: 'Too few results - try broadening your search',
            impact: -1,
          });
        }
      });
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  // Helper methods
  private static buildWhereClause(filters: FacetFilters, projectId?: string): any {
    const where: any = {};

    if (projectId) {
      where.sourceUrl = { contains: projectId };
    }

    if (filters.contentTypes && filters.contentTypes.length > 0) {
      where.contentType = { in: filters.contentTypes };
    }

    if (filters.languages && filters.languages.length > 0) {
      where.language = { in: filters.languages };
    }

    if (filters.complexity && filters.complexity.length > 0) {
      where.complexity = { in: filters.complexity };
    }

    if (filters.sourceTypes && filters.sourceTypes.length > 0) {
      where.sourceType = { in: filters.sourceTypes };
    }

    if (filters.freshnessRange) {
      where.freshness = {
        gte: filters.freshnessRange.min,
        lte: filters.freshnessRange.max,
      };
    }

    if (filters.popularityRange) {
      where.popularity = {
        gte: filters.popularityRange.min,
        lte: filters.popularityRange.max,
      };
    }

    if (filters.wordCountRange) {
      where.wordCount = {
        gte: filters.wordCountRange.min,
        lte: filters.wordCountRange.max,
      };
    }

    if (filters.dateRange) {
      where.updatedAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end,
      };
    }

    return where;
  }

  private static formatContentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      api: 'API Reference',
      tutorial: 'Tutorial',
      guide: 'Guide',
      example: 'Code Example',
      changelog: 'Changelog',
      documentation: 'Documentation',
      reference: 'Reference',
      faq: 'FAQ',
    };
    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  private static formatLanguageLabel(language: string): string {
    const labels: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      csharp: 'C#',
      cpp: 'C++',
      go: 'Go',
      rust: 'Rust',
      php: 'PHP',
      ruby: 'Ruby',
      swift: 'Swift',
      kotlin: 'Kotlin',
    };
    return labels[language] || language.charAt(0).toUpperCase() + language.slice(1);
  }

  private static formatSourceTypeLabel(sourceType: string): string {
    const labels: Record<string, string> = {
      git: 'Git Repository',
      llmstxt: 'LLMs.txt File',
      website: 'Documentation Website',
    };
    return labels[sourceType] || sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
  }

  private static extractRepositoryName(url: string): string | null {
    // Extract repository name from various URL formats
    const patterns = [
      /github\.com\/([^\/]+\/[^\/]+)/,
      /gitlab\.com\/([^\/]+\/[^\/]+)/,
      /bitbucket\.org\/([^\/]+\/[^\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Try to extract from domain
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  private static getPopularContentTypes(
    documents: any[]
  ): Array<{ value: string; label: string; count: number }> {
    const typeCounts = new Map<string, number>();

    documents.forEach((doc) => {
      const type = doc.contentType || 'other';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({
        value: type,
        label: this.formatContentTypeLabel(type),
        count,
      }));
  }

  private static isBeginnerQuery(query: string): boolean {
    const beginnerKeywords = [
      'getting started',
      'how to',
      'introduction',
      'basics',
      'beginner',
      'tutorial',
      'first steps',
      'setup',
      'install',
      'start',
    ];

    const lowerQuery = query.toLowerCase();
    return beginnerKeywords.some((keyword) => lowerQuery.includes(keyword));
  }
}
