import { PrismaClient } from './generated/prisma';
import { retrieve } from './memory'; // Semantic search
import { SearchResultsCache } from './cache';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

interface SearchFilters {
  contentType?: string[];
  sourceType?: string[];
  language?: string[];
  complexity?: string[];
  freshness?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  wordCount?: {
    min?: number;
    max?: number;
  };
}

interface SearchOptions {
  searchType?: 'semantic' | 'keyword' | 'hybrid';
  limit?: number;
  offset?: number;
  boostFactors?: {
    semantic?: number;
    keyword?: number;
    popularity?: number;
    freshness?: number;
  };
}

interface HybridSearchResult {
  id: string;
  content: string;
  title?: string;
  summary?: string;
  source: {
    url: string;
    type: string;
    path?: string;
  };
  metadata: {
    contentType: string;
    language?: string;
    complexity: string;
    wordCount: number;
    freshness: number;
    popularity: number;
  };
  scores: {
    semantic?: number;
    keyword?: number;
    popularity?: number;
    freshness?: number;
    combined: number;
  };
  timestamp: Date;
}

interface SearchResponse {
  query: string;
  searchType: string;
  totalResults: number;
  searchTime: number;
  cached: boolean;
  results: HybridSearchResult[];
  suggestions?: string[];
  facets?: {
    contentTypes: Array<{ value: string; count: number }>;
    sourceTypes: Array<{ value: string; count: number }>;
    languages: Array<{ value: string; count: number }>;
    complexities: Array<{ value: string; count: number }>;
  };
}

export class HybridSearchEngine {
  static async search(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const searchType = options.searchType || 'hybrid';
    const limit = Math.min(options.limit || 10, 50);
    const offset = options.offset || 0;

    // Generate cache key
    const cacheKey = this.generateCacheKey(query, filters, options);

    // Check cache first
    const cachedResult = await SearchResultsCache.get(cacheKey);
    if (cachedResult) {
      console.log(`Using cached hybrid search results for: ${query}`);
      return {
        ...cachedResult.results[0],
        cached: true,
        searchTime: cachedResult.metadata.searchTime,
      };
    }

    // Track the search query
    await this.trackSearchQuery(query, searchType, filters);

    let results: HybridSearchResult[] = [];

    switch (searchType) {
      case 'semantic':
        results = await this.performSemanticSearch(query, filters, options);
        break;
      case 'keyword':
        results = await this.performKeywordSearch(query, filters, options);
        break;
      case 'hybrid':
      default:
        results = await this.performHybridSearch(query, filters, options);
        break;
    }

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    // Get search suggestions
    const suggestions = await this.getSearchSuggestions(query);

    // Get facets for filtering
    const facets = await this.getFacets(query, filters);

    const searchTime = Date.now() - startTime;

    const response: SearchResponse = {
      query,
      searchType,
      totalResults: results.length,
      searchTime,
      cached: false,
      results: paginatedResults,
      suggestions,
      facets,
    };

    // Cache the results
    await SearchResultsCache.set(
      cacheKey,
      [response],
      {
        totalResults: results.length,
        searchTime,
      },
      30 * 60 // 30 minutes TTL for hybrid search
    );

    return response;
  }

  private static async performHybridSearch(
    query: string,
    filters: SearchFilters,
    options: SearchOptions
  ): Promise<HybridSearchResult[]> {
    const boostFactors = {
      semantic: 0.6,
      keyword: 0.3,
      popularity: 0.05,
      freshness: 0.05,
      ...options.boostFactors,
    };

    // Perform both semantic and keyword searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.performSemanticSearch(query, filters, { ...options, searchType: 'semantic' }),
      this.performKeywordSearch(query, filters, { ...options, searchType: 'keyword' }),
    ]);

    // Create a map to merge results by content hash
    const resultMap = new Map<string, HybridSearchResult>();

    // Add semantic results
    for (const result of semanticResults) {
      const contentHash = this.generateContentHash(result.content);
      resultMap.set(contentHash, {
        ...result,
        scores: {
          ...result.scores,
          semantic: result.scores.combined,
        },
      });
    }

    // Merge with keyword results
    for (const result of keywordResults) {
      const contentHash = this.generateContentHash(result.content);
      const existing = resultMap.get(contentHash);

      if (existing) {
        // Merge scores
        existing.scores.keyword = result.scores.combined;
        existing.scores.combined = this.calculateHybridScore(existing.scores, boostFactors);
      } else {
        // Add as keyword-only result
        resultMap.set(contentHash, {
          ...result,
          scores: {
            ...result.scores,
            keyword: result.scores.combined,
          },
        });
      }
    }

    // Calculate final hybrid scores and sort
    const hybridResults = Array.from(resultMap.values())
      .map((result) => ({
        ...result,
        scores: {
          ...result.scores,
          combined: this.calculateHybridScore(result.scores, boostFactors),
        },
      }))
      .sort((a, b) => b.scores.combined - a.scores.combined);

    return hybridResults;
  }

  private static async performSemanticSearch(
    query: string,
    filters: SearchFilters,
    options: SearchOptions
  ): Promise<HybridSearchResult[]> {
    // Use existing semantic search from memory.ts
    const semanticFilters = {
      ...(filters.contentType && { type: filters.contentType[0] }),
      ...(filters.language && { language: filters.language[0] }),
    };

    const semanticResults = await retrieve({
      query,
      project_id: 'global',
      scope: 'global',
      filters: semanticFilters,
    });

    // Convert to hybrid search format
    return (semanticResults || []).map((result: any) => ({
      id: result.id || this.generateContentHash(result.content),
      content: result.content,
      title: this.extractTitle(result.content),
      summary: this.generateSummary(result.content),
      source: {
        url: result.metadata.source || '',
        type: 'vector',
        path: result.metadata.source,
      },
      metadata: {
        contentType: result.metadata.type || 'documentation',
        language: result.metadata.language,
        complexity: 'medium',
        wordCount: result.content.split(/\s+/).length,
        freshness: 1.0,
        popularity: 0,
      },
      scores: {
        semantic: result.similarity || 0,
        combined: result.similarity || 0,
      },
      timestamp: new Date(),
    }));
  }

  private static async performKeywordSearch(
    query: string,
    filters: SearchFilters,
    options: SearchOptions
  ): Promise<HybridSearchResult[]> {
    // Build SQL query for full-text search
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    // Full-text search on content and title
    if (query.trim()) {
      // SQLite FTS-style query
      const searchTerms = query
        .split(/\s+/)
        .filter((term) => term.length > 2)
        .map((term) => `"${term}"*`)
        .join(' OR ');

      whereConditions.push(`(content LIKE ? OR title LIKE ?)`);
      queryParams.push(`%${query}%`, `%${query}%`);
    }

    // Apply filters
    if (filters.contentType && filters.contentType.length > 0) {
      const placeholders = filters.contentType.map(() => '?').join(',');
      whereConditions.push(`contentType IN (${placeholders})`);
      queryParams.push(...filters.contentType);
    }

    if (filters.sourceType && filters.sourceType.length > 0) {
      const placeholders = filters.sourceType.map(() => '?').join(',');
      whereConditions.push(`sourceType IN (${placeholders})`);
      queryParams.push(...filters.sourceType);
    }

    if (filters.language && filters.language.length > 0) {
      const placeholders = filters.language.map(() => '?').join(',');
      whereConditions.push(`language IN (${placeholders})`);
      queryParams.push(...filters.language);
    }

    if (filters.complexity && filters.complexity.length > 0) {
      const placeholders = filters.complexity.map(() => '?').join(',');
      whereConditions.push(`complexity IN (${placeholders})`);
      queryParams.push(...filters.complexity);
    }

    if (filters.freshness) {
      if (filters.freshness.min !== undefined) {
        whereConditions.push('freshness >= ?');
        queryParams.push(filters.freshness.min);
      }
      if (filters.freshness.max !== undefined) {
        whereConditions.push('freshness <= ?');
        queryParams.push(filters.freshness.max);
      }
    }

    if (filters.wordCount) {
      if (filters.wordCount.min !== undefined) {
        whereConditions.push('wordCount >= ?');
        queryParams.push(filters.wordCount.min);
      }
      if (filters.wordCount.max !== undefined) {
        whereConditions.push('wordCount <= ?');
        queryParams.push(filters.wordCount.max);
      }
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        whereConditions.push('createdAt >= ?');
        queryParams.push(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        whereConditions.push('createdAt <= ?');
        queryParams.push(filters.dateRange.end);
      }
    }

    // Build and execute query
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sqlQuery = `
      SELECT * FROM search_index 
      ${whereClause}
      ORDER BY 
        popularity DESC,
        freshness DESC,
        wordCount DESC
      LIMIT ?
    `;
    queryParams.push(options.limit || 50);

    try {
      const results = await prisma.$queryRawUnsafe<any[]>(sqlQuery, ...queryParams);

      // Convert to hybrid search format
      return results.map((row) => ({
        id: row.id,
        content: row.content,
        title: row.title,
        summary: row.summary,
        source: {
          url: row.sourceUrl,
          type: row.sourceType,
          path: row.sourceUrl,
        },
        metadata: {
          contentType: row.contentType,
          language: row.language,
          complexity: row.complexity,
          wordCount: row.wordCount,
          freshness: row.freshness,
          popularity: row.popularity,
        },
        scores: {
          keyword: this.calculateKeywordScore(query, row.content, row.title),
          popularity: row.popularity / 100, // Normalize to 0-1
          freshness: row.freshness,
          combined: 0, // Will be calculated later
        },
        timestamp: new Date(row.createdAt),
      }));
    } catch (error) {
      console.error('Keyword search failed:', error);
      return [];
    }
  }

  private static calculateKeywordScore(query: string, content: string, title?: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const titleLower = (title || '').toLowerCase();

    let score = 0;
    const totalTerms = queryTerms.length;

    for (const term of queryTerms) {
      if (term.length < 2) continue;

      // Title matches get higher weight
      if (titleLower.includes(term)) {
        score += 3;
      }

      // Count occurrences in content
      const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(contentMatches * 0.5, 2); // Cap content score per term
    }

    return Math.min(score / (totalTerms * 3), 1); // Normalize to 0-1
  }

  private static calculateHybridScore(
    scores: { semantic?: number; keyword?: number; popularity?: number; freshness?: number },
    boostFactors: { semantic: number; keyword: number; popularity: number; freshness: number }
  ): number {
    return (
      (scores.semantic || 0) * boostFactors.semantic +
      (scores.keyword || 0) * boostFactors.keyword +
      (scores.popularity || 0) * boostFactors.popularity +
      (scores.freshness || 0) * boostFactors.freshness
    );
  }

  private static async trackSearchQuery(
    query: string,
    searchType: string,
    filters: SearchFilters
  ): Promise<void> {
    try {
      const queryHash = createHash('sha256')
        .update(query.toLowerCase().trim())
        .digest('hex')
        .substring(0, 16);

      await prisma.searchQuery.create({
        data: {
          query,
          queryHash,
          searchType,
          filters: JSON.stringify(filters),
        },
      });

      // Update or create search suggestion
      await prisma.searchSuggestion.upsert({
        where: { suggestion: query },
        update: {
          searchCount: { increment: 1 },
          lastUsed: new Date(),
        },
        create: {
          suggestion: query,
          category: 'popular',
          searchCount: 1,
        },
      });
    } catch (error) {
      console.error('Failed to track search query:', error);
    }
  }

  private static async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      // Get popular suggestions that start with or contain the query
      const suggestions = await prisma.searchSuggestion.findMany({
        where: {
          OR: [{ suggestion: { contains: query } }, { suggestion: { startsWith: query } }],
        },
        orderBy: [{ searchCount: 'desc' }, { lastUsed: 'desc' }],
        take: 5,
      });

      return suggestions.map((s) => s.suggestion);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  private static async getFacets(
    query: string,
    filters: SearchFilters
  ): Promise<SearchResponse['facets']> {
    try {
      // Get facet counts from search index
      const [contentTypes, sourceTypes, languages, complexities] = await Promise.all([
        prisma.$queryRaw<Array<{ contentType: string; count: number }>>`
          SELECT contentType, COUNT(*) as count 
          FROM search_index 
          WHERE content LIKE ${'%' + query + '%'} OR title LIKE ${'%' + query + '%'}
          GROUP BY contentType 
          ORDER BY count DESC
        `,
        prisma.$queryRaw<Array<{ sourceType: string; count: number }>>`
          SELECT sourceType, COUNT(*) as count 
          FROM search_index 
          WHERE content LIKE ${'%' + query + '%'} OR title LIKE ${'%' + query + '%'}
          GROUP BY sourceType 
          ORDER BY count DESC
        `,
        prisma.$queryRaw<Array<{ language: string; count: number }>>`
          SELECT language, COUNT(*) as count 
          FROM search_index 
          WHERE content LIKE ${'%' + query + '%'} OR title LIKE ${'%' + query + '%'}
          AND language IS NOT NULL
          GROUP BY language 
          ORDER BY count DESC
        `,
        prisma.$queryRaw<Array<{ complexity: string; count: number }>>`
          SELECT complexity, COUNT(*) as count 
          FROM search_index 
          WHERE content LIKE ${'%' + query + '%'} OR title LIKE ${'%' + query + '%'}
          GROUP BY complexity 
          ORDER BY count DESC
        `,
      ]);

      return {
        contentTypes: contentTypes.map((ct) => ({
          value: ct.contentType,
          count: Number(ct.count),
        })),
        sourceTypes: sourceTypes.map((st) => ({ value: st.sourceType, count: Number(st.count) })),
        languages: languages.map((l) => ({ value: l.language, count: Number(l.count) })),
        complexities: complexities.map((c) => ({ value: c.complexity, count: Number(c.count) })),
      };
    } catch (error) {
      console.error('Failed to get search facets:', error);
      return {
        contentTypes: [],
        sourceTypes: [],
        languages: [],
        complexities: [],
      };
    }
  }

  // Index content into search index for keyword search
  static async indexContent(
    content: string,
    sourceUrl: string,
    metadata: {
      sourceType: string;
      contentType: string;
      language?: string;
      title?: string;
      complexity?: string;
    }
  ): Promise<void> {
    try {
      const contentHash = this.generateContentHash(content);
      const wordCount = content.split(/\s+/).length;
      const summary = this.generateSummary(content);
      const freshness = this.calculateFreshness(new Date());

      await prisma.searchIndex.upsert({
        where: { contentHash },
        update: {
          content,
          title: metadata.title,
          summary,
          sourceUrl,
          sourceType: metadata.sourceType,
          contentType: metadata.contentType,
          language: metadata.language,
          wordCount,
          complexity: metadata.complexity || 'medium',
          freshness,
          updatedAt: new Date(),
        },
        create: {
          contentHash,
          content,
          title: metadata.title,
          summary,
          sourceUrl,
          sourceType: metadata.sourceType,
          contentType: metadata.contentType,
          language: metadata.language,
          wordCount,
          complexity: metadata.complexity || 'medium',
          freshness,
        },
      });
    } catch (error) {
      console.error('Failed to index content for search:', error);
    }
  }

  private static generateCacheKey(
    query: string,
    filters: SearchFilters,
    options: SearchOptions
  ): string {
    const keyObj = {
      query: query.toLowerCase().trim(),
      filters,
      searchType: options.searchType,
      limit: options.limit,
      offset: options.offset,
      boostFactors: options.boostFactors,
    };

    return createHash('sha256').update(JSON.stringify(keyObj)).digest('hex').substring(0, 16);
  }

  private static generateContentHash(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex').substring(0, 16);
  }

  private static extractTitle(content: string): string | undefined {
    // Extract title from markdown headers or first line
    const lines = content.split('\n');
    for (const line of lines.slice(0, 3)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return trimmed.substring(2).trim();
      }
      if (trimmed.length > 10 && trimmed.length < 100) {
        return trimmed;
      }
    }
    return undefined;
  }

  private static generateSummary(content: string, maxLength: number = 200): string {
    // Generate a summary from the first meaningful sentences
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    let summary = '';

    for (const sentence of sentences.slice(0, 3)) {
      if (summary.length + sentence.length > maxLength) break;
      summary += sentence.trim() + '. ';
    }

    return summary.trim() || content.substring(0, maxLength).trim() + '...';
  }

  private static calculateFreshness(createdAt: Date): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: content is fully fresh for 7 days, then decays
    if (ageInDays <= 7) return 1.0;
    if (ageInDays <= 30) return 0.8;
    if (ageInDays <= 90) return 0.6;
    if (ageInDays <= 180) return 0.4;
    if (ageInDays <= 365) return 0.2;
    return 0.1;
  }
}
