import { PrismaClient } from './generated/prisma';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

interface QuerySuggestion {
  text: string;
  type: 'completion' | 'correction' | 'expansion' | 'related';
  confidence: number;
  popularity?: number;
  category?: string;
}

interface QueryExpansion {
  originalQuery: string;
  expandedQueries: string[];
  synonyms: Record<string, string[]>;
  relatedTerms: string[];
}

interface QueryAnalysis {
  intent: 'search' | 'lookup' | 'learn' | 'compare' | 'troubleshoot';
  confidence: number;
  entities: Array<{
    text: string;
    type: 'technology' | 'concept' | 'api' | 'method' | 'library';
    confidence: number;
  }>;
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

export class QueryEnhancer {
  // Common programming and documentation terms for expansion
  private static readonly TECH_SYNONYMS: Record<string, string[]> = {
    javascript: ['js', 'ecmascript', 'node', 'nodejs'],
    typescript: ['ts', 'tsc'],
    react: ['reactjs', 'react.js'],
    vue: ['vuejs', 'vue.js'],
    angular: ['angularjs'],
    api: ['endpoint', 'service', 'interface'],
    function: ['method', 'procedure', 'func'],
    array: ['list', 'collection'],
    object: ['dict', 'dictionary', 'map'],
    error: ['exception', 'bug', 'issue'],
    config: ['configuration', 'settings', 'options'],
    auth: ['authentication', 'authorization', 'login'],
    db: ['database', 'persistence', 'storage'],
    ui: ['interface', 'frontend', 'view'],
    backend: ['server', 'api', 'service'],
    frontend: ['client', 'ui', 'interface'],
    deploy: ['deployment', 'publish', 'release'],
    test: ['testing', 'spec', 'unit test'],
    debug: ['debugging', 'troubleshoot', 'fix'],
  };

  private static readonly INTENT_PATTERNS = {
    search: ['how to', 'what is', 'where is', 'find', 'search'],
    lookup: ['documentation', 'docs', 'reference', 'api'],
    learn: ['tutorial', 'guide', 'learn', 'example', 'getting started'],
    compare: ['vs', 'versus', 'difference', 'compare', 'better'],
    troubleshoot: ['error', 'bug', 'issue', 'problem', 'fix', 'debug', 'not working'],
  };

  private static readonly COMPLEXITY_INDICATORS = {
    beginner: ['basic', 'simple', 'intro', 'getting started', 'tutorial', 'beginner'],
    intermediate: ['guide', 'how to', 'implement', 'setup', 'configure'],
    advanced: ['optimize', 'performance', 'architecture', 'scalability', 'advanced', 'deep dive'],
  };

  // Get auto-completion suggestions as user types
  static async getAutoCompletions(
    partialQuery: string,
    limit: number = 5
  ): Promise<QuerySuggestion[]> {
    if (partialQuery.trim().length < 2) return [];

    try {
      // Get popular completions from search history
      const popularCompletions = await prisma.searchSuggestion.findMany({
        where: {
          suggestion: {
            startsWith: partialQuery,
          },
        },
        orderBy: [{ searchCount: 'desc' }, { lastUsed: 'desc' }],
        take: limit,
      });

      // Get recent searches that contain this partial query
      const recentSuggestions = await prisma.searchQuery.findMany({
        where: {
          query: {
            contains: partialQuery,
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        distinct: ['query'],
      });

      const suggestions: QuerySuggestion[] = [];

      // Add popular completions
      for (const completion of popularCompletions) {
        suggestions.push({
          text: completion.suggestion,
          type: 'completion',
          confidence: Math.min(completion.searchCount / 10, 1.0),
          popularity: completion.searchCount,
          category: completion.category,
        });
      }

      // Add recent suggestions
      for (const recent of recentSuggestions) {
        if (!suggestions.some((s) => s.text === recent.query)) {
          suggestions.push({
            text: recent.query,
            type: 'completion',
            confidence: 0.7,
            category: 'recent',
          });
        }
      }

      // Add smart completions based on patterns
      const smartCompletions = this.generateSmartCompletions(partialQuery);
      for (const smart of smartCompletions) {
        if (!suggestions.some((s) => s.text === smart.text)) {
          suggestions.push(smart);
        }
      }

      return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
    } catch (error) {
      console.error('Error getting auto-completions:', error);
      return [];
    }
  }

  // Expand query with synonyms and related terms
  static async expandQuery(query: string): Promise<QueryExpansion> {
    const originalTerms = this.tokenizeQuery(query);
    const expandedQueries: string[] = [];
    const synonyms: Record<string, string[]> = {};
    const relatedTerms: string[] = [];

    // Find synonyms for each term
    for (const term of originalTerms) {
      const termSynonyms = this.findSynonyms(term.toLowerCase());
      if (termSynonyms.length > 0) {
        synonyms[term] = termSynonyms;

        // Generate expanded queries with synonyms
        for (const synonym of termSynonyms.slice(0, 2)) {
          // Limit to top 2 synonyms
          const expandedQuery = query.replace(new RegExp(`\\b${term}\\b`, 'gi'), synonym);
          if (expandedQuery !== query) {
            expandedQueries.push(expandedQuery);
          }
        }
      }
    }

    // Find related terms from search history
    try {
      const relatedQueries = await prisma.searchQuery.findMany({
        where: {
          OR: originalTerms.map((term) => ({
            query: {
              contains: term,
            },
          })),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const termCounts = new Map<string, number>();

      for (const relatedQuery of relatedQueries) {
        const queryTerms = this.tokenizeQuery(relatedQuery.query);
        for (const term of queryTerms) {
          if (!originalTerms.includes(term.toLowerCase())) {
            termCounts.set(term.toLowerCase(), (termCounts.get(term.toLowerCase()) || 0) + 1);
          }
        }
      }

      // Get top related terms
      const sortedTerms = Array.from(termCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([term]) => term);
      relatedTerms.push(...sortedTerms);
    } catch (error) {
      console.error('Error finding related terms:', error);
    }

    return {
      originalQuery: query,
      expandedQueries: Array.from(new Set(expandedQueries)).slice(0, 5),
      synonyms,
      relatedTerms,
    };
  }

  // Analyze query intent and characteristics
  static analyzeQuery(query: string): QueryAnalysis {
    const queryLower = query.toLowerCase();

    // Detect intent
    let intent: QueryAnalysis['intent'] = 'search';
    let intentConfidence = 0.5;

    for (const [intentType, patterns] of Object.entries(this.INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (queryLower.includes(pattern)) {
          intent = intentType as QueryAnalysis['intent'];
          intentConfidence = 0.8;
          break;
        }
      }
      if (intentConfidence > 0.5) break;
    }

    // Extract entities
    const entities = this.extractEntities(query);

    // Detect complexity
    let complexity: QueryAnalysis['complexity'] = 'intermediate';

    for (const [level, indicators] of Object.entries(this.COMPLEXITY_INDICATORS)) {
      for (const indicator of indicators) {
        if (queryLower.includes(indicator)) {
          complexity = level as QueryAnalysis['complexity'];
          break;
        }
      }
    }

    return {
      intent,
      confidence: intentConfidence,
      entities,
      complexity,
    };
  }

  // Get spelling corrections for query
  static async getSpellingCorrections(query: string): Promise<QuerySuggestion[]> {
    const corrections: QuerySuggestion[] = [];

    try {
      // Find similar queries in search history using basic string similarity
      const recentQueries = await prisma.searchQuery.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      for (const dbQuery of recentQueries) {
        const similarity = this.calculateStringSimilarity(query, dbQuery.query);

        if (similarity > 0.7 && similarity < 0.95) {
          // Likely corrections
          corrections.push({
            text: dbQuery.query,
            type: 'correction',
            confidence: similarity,
          });
        }
      }

      return corrections.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    } catch (error) {
      console.error('Error getting spelling corrections:', error);
      return [];
    }
  }

  // Save successful search query for future suggestions
  static async recordSuccessfulQuery(
    query: string,
    resultCount: number,
    userClicked: boolean = false
  ): Promise<void> {
    try {
      // Update search suggestion popularity
      await prisma.searchSuggestion.upsert({
        where: { suggestion: query },
        update: {
          searchCount: { increment: userClicked ? 2 : 1 }, // Weight clicks higher
          lastUsed: new Date(),
        },
        create: {
          suggestion: query,
          category: resultCount > 0 ? 'popular' : 'low-results',
          searchCount: 1,
        },
      });

      // Generate and store related suggestions
      const terms = this.tokenizeQuery(query);
      for (const term of terms) {
        if (term.length > 3) {
          await prisma.searchSuggestion.upsert({
            where: { suggestion: term },
            update: {
              searchCount: { increment: 1 },
              lastUsed: new Date(),
            },
            create: {
              suggestion: term,
              category: 'related',
              searchCount: 1,
              relatedTo: query,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error recording successful query:', error);
    }
  }

  private static generateSmartCompletions(partialQuery: string): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const queryLower = partialQuery.toLowerCase();

    // Common patterns and completions
    const completionPatterns = [
      {
        pattern: /^how to/,
        completions: ['how to implement', 'how to use', 'how to setup', 'how to configure'],
      },
      {
        pattern: /^what is/,
        completions: ['what is the difference', 'what is best practice', 'what is the purpose'],
      },
      {
        pattern: /error$/,
        completions: [queryLower + ' fix', queryLower + ' solution', queryLower + ' troubleshoot'],
      },
      {
        pattern: /api$/,
        completions: [
          queryLower + ' documentation',
          queryLower + ' reference',
          queryLower + ' example',
        ],
      },
      {
        pattern: /\w+$/,
        completions: [queryLower + ' tutorial', queryLower + ' example', queryLower + ' guide'],
      },
    ];

    for (const { pattern, completions } of completionPatterns) {
      if (pattern.test(queryLower)) {
        for (const completion of completions) {
          if (completion !== queryLower) {
            suggestions.push({
              text: completion,
              type: 'completion',
              confidence: 0.6,
            });
          }
        }
        break; // Only apply first matching pattern
      }
    }

    return suggestions;
  }

  private static tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .filter(
        (term) =>
          !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(
            term
          )
      );
  }

  private static findSynonyms(term: string): string[] {
    const synonyms: string[] = [];

    // Direct lookup
    if (this.TECH_SYNONYMS[term]) {
      synonyms.push(...this.TECH_SYNONYMS[term]);
    }

    // Reverse lookup
    for (const [key, values] of Object.entries(this.TECH_SYNONYMS)) {
      if (values.includes(term)) {
        synonyms.push(key, ...values.filter((v) => v !== term));
      }
    }

    return Array.from(new Set(synonyms));
  }

  private static extractEntities(query: string): QueryAnalysis['entities'] {
    const entities: QueryAnalysis['entities'] = [];
    const queryLower = query.toLowerCase();

    // Technology entities
    const techTerms = Object.keys(this.TECH_SYNONYMS);
    for (const term of techTerms) {
      if (queryLower.includes(term)) {
        entities.push({
          text: term,
          type: 'technology',
          confidence: 0.8,
        });
      }
    }

    // API/method patterns
    const apiPatterns = [
      /\b(\w+)\(\)/g, // function calls
      /\b(\w+)\.(\w+)/g, // method calls
      /\b([A-Z][a-zA-Z]*)/g, // PascalCase (likely classes/interfaces)
    ];

    for (const pattern of apiPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          text: match[1] || match[0],
          type: 'api',
          confidence: 0.7,
        });
      }
    }

    return entities;
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; ++i) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= len2; ++j) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= len2; ++j) {
      for (let i = 1; i <= len1; ++i) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  }
}
