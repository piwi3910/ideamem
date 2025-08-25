export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'completion' | 'filter' | 'command';
  score: number;
  source: 'history' | 'semantic' | 'popular' | 'context';
  metadata?: {
    category?: string;
    language?: string;
    resultCount?: number;
    lastUsed?: Date;
    frequency?: number;
  };
  icon?: string;
  description?: string;
}

export interface SearchContext {
  currentQuery: string;
  cursorPosition: number;
  recentQueries: string[];
  activeFilters: Record<string, any>;
  searchHistory: Array<{ query: string; timestamp: Date; resultsCount: number }>;
  popularTerms: Array<{ term: string; count: number }>;
  semanticContext?: string[];
}

export interface AutoCompleteOptions {
  maxSuggestions: number;
  debounceMs: number;
  minQueryLength: number;
  includeHistory: boolean;
  includeSemantic: boolean;
  includePopular: boolean;
  includeCommands: boolean;
  enableFuzzyMatch: boolean;
  contextualBoost: boolean;
}

// Search commands for advanced functionality
export const SEARCH_COMMANDS = [
  {
    command: 'type:',
    description: 'Filter by content type',
    examples: ['type:code', 'type:documentation', 'type:conversation'],
    icon: '🏷️',
  },
  {
    command: 'lang:',
    description: 'Filter by programming language',
    examples: ['lang:javascript', 'lang:python', 'lang:typescript'],
    icon: '💻',
  },
  {
    command: 'source:',
    description: 'Filter by source',
    examples: ['source:github', 'source:docs', 'source:stackoverflow'],
    icon: '📁',
  },
  {
    command: 'after:',
    description: 'Filter by date (after)',
    examples: ['after:2024-01-01', 'after:last-week', 'after:yesterday'],
    icon: '📅',
  },
  {
    command: 'before:',
    description: 'Filter by date (before)',
    examples: ['before:2024-01-01', 'before:last-month'],
    icon: '📅',
  },
  {
    command: 'project:',
    description: 'Filter by project',
    examples: ['project:my-app', 'project:frontend'],
    icon: '📂',
  },
  {
    command: 'similar:',
    description: 'Find similar content',
    examples: ['similar:"function implementation"'],
    icon: '🔗',
  },
  {
    command: 'exact:',
    description: 'Exact phrase match',
    examples: ['exact:"error handling"'],
    icon: '🎯',
  },
];

export class SearchSuggestionEngine {
  private options: AutoCompleteOptions;
  private trie: TrieNode;
  private semanticCache: Map<string, string[]> = new Map();

  constructor(options: Partial<AutoCompleteOptions> = {}) {
    this.options = {
      maxSuggestions: 10,
      debounceMs: 200,
      minQueryLength: 1,
      includeHistory: true,
      includeSemantic: true,
      includePopular: true,
      includeCommands: true,
      enableFuzzyMatch: true,
      contextualBoost: true,
      ...options,
    };

    this.trie = new TrieNode();
    this.buildCommandTrie();
  }

  async generateSuggestions(context: SearchContext): Promise<SearchSuggestion[]> {
    const { currentQuery, cursorPosition } = context;

    if (currentQuery.length < this.options.minQueryLength) {
      return this.getDefaultSuggestions(context);
    }

    const suggestions: SearchSuggestion[] = [];
    const queryLower = currentQuery.toLowerCase();

    // 1. Command completions
    if (this.options.includeCommands) {
      const commandSuggestions = this.getCommandSuggestions(currentQuery, cursorPosition);
      suggestions.push(...commandSuggestions);
    }

    // 2. History-based suggestions
    if (this.options.includeHistory && context.searchHistory.length > 0) {
      const historySuggestions = this.getHistorySuggestions(currentQuery, context);
      suggestions.push(...historySuggestions);
    }

    // 3. Popular terms suggestions
    if (this.options.includePopular && context.popularTerms.length > 0) {
      const popularSuggestions = this.getPopularSuggestions(currentQuery, context);
      suggestions.push(...popularSuggestions);
    }

    // 4. Semantic suggestions
    if (this.options.includeSemantic) {
      const semanticSuggestions = await this.getSemanticSuggestions(currentQuery, context);
      suggestions.push(...semanticSuggestions);
    }

    // 5. Query completions
    const completionSuggestions = this.getQueryCompletions(currentQuery, context);
    suggestions.push(...completionSuggestions);

    // Deduplicate, score, and sort
    return this.rankAndFilterSuggestions(suggestions, context);
  }

  private getCommandSuggestions(query: string, cursorPosition: number): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const beforeCursor = query.slice(0, cursorPosition);
    const afterCursor = query.slice(cursorPosition);

    // Check if we're in the middle of typing a command
    const commandMatch = beforeCursor.match(/(\w+):(\w*)$/);

    if (commandMatch) {
      const [, command, partialValue] = commandMatch;
      const commandDef = SEARCH_COMMANDS.find((c) => c.command === `${command}:`);

      if (commandDef) {
        // Suggest values for this command
        commandDef.examples.forEach((example, index) => {
          const value = example.replace(`${command}:`, '');
          if (value.toLowerCase().startsWith(partialValue.toLowerCase())) {
            suggestions.push({
              id: `command-${command}-${index}`,
              text: `${command}:${value}`,
              type: 'command',
              score: 0.9 - index * 0.1,
              source: 'context',
              icon: commandDef.icon,
              description: `${commandDef.description}: ${value}`,
            });
          }
        });
      }
    } else {
      // Suggest command prefixes
      const lastWord = beforeCursor.split(' ').pop() || '';

      SEARCH_COMMANDS.forEach((cmd, index) => {
        if (cmd.command.startsWith(lastWord.toLowerCase()) || lastWord === '') {
          suggestions.push({
            id: `command-prefix-${index}`,
            text: cmd.command,
            type: 'command',
            score: 0.8 - index * 0.05,
            source: 'context',
            icon: cmd.icon,
            description: cmd.description,
          });
        }
      });
    }

    return suggestions;
  }

  private getHistorySuggestions(query: string, context: SearchContext): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase();

    context.searchHistory
      .filter(
        (h) => h.query.toLowerCase().includes(queryLower) && h.query.toLowerCase() !== queryLower
      )
      .slice(0, 5)
      .forEach((historyItem, index) => {
        suggestions.push({
          id: `history-${index}`,
          text: historyItem.query,
          type: 'query',
          score: 0.7 - index * 0.1,
          source: 'history',
          icon: '🕒',
          metadata: {
            lastUsed: historyItem.timestamp,
            resultCount: historyItem.resultsCount,
          },
          description: `${historyItem.resultsCount} results • ${this.formatTimeAgo(historyItem.timestamp)}`,
        });
      });

    return suggestions;
  }

  private getPopularSuggestions(query: string, context: SearchContext): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase();

    context.popularTerms
      .filter(
        (term) =>
          term.term.toLowerCase().includes(queryLower) && term.term.toLowerCase() !== queryLower
      )
      .slice(0, 5)
      .forEach((term, index) => {
        suggestions.push({
          id: `popular-${index}`,
          text: term.term,
          type: 'query',
          score: 0.6 - index * 0.08,
          source: 'popular',
          icon: '🔥',
          metadata: {
            frequency: term.count,
          },
          description: `Popular • ${term.count} searches`,
        });
      });

    return suggestions;
  }

  private async getSemanticSuggestions(
    query: string,
    context: SearchContext
  ): Promise<SearchSuggestion[]> {
    // In a real implementation, this would call a semantic similarity service
    // For now, we'll simulate with cached results and simple keyword matching

    if (this.semanticCache.has(query)) {
      const cached = this.semanticCache.get(query)!;
      return cached.map((text, index) => ({
        id: `semantic-${index}`,
        text,
        type: 'query',
        score: 0.65 - index * 0.1,
        source: 'semantic',
        icon: '🧠',
        description: 'Semantically similar',
      }));
    }

    // Simulate semantic suggestions based on keywords
    const semanticSuggestions = this.generateSemanticSuggestions(query);
    this.semanticCache.set(query, semanticSuggestions);

    return semanticSuggestions.map((text, index) => ({
      id: `semantic-${index}`,
      text,
      type: 'query',
      score: 0.65 - index * 0.1,
      source: 'semantic',
      icon: '🧠',
      description: 'Semantically similar',
    }));
  }

  private generateSemanticSuggestions(query: string): string[] {
    const queryLower = query.toLowerCase();
    const semanticMap: Record<string, string[]> = {
      react: ['React hooks', 'React components', 'React state management', 'React lifecycle'],
      javascript: [
        'JavaScript functions',
        'JavaScript arrays',
        'JavaScript promises',
        'ES6 features',
      ],
      typescript: [
        'TypeScript interfaces',
        'TypeScript generics',
        'TypeScript types',
        'TypeScript decorators',
      ],
      api: ['REST API', 'GraphQL API', 'API design', 'API authentication'],
      error: ['error handling', 'exception handling', 'debugging', 'try catch'],
      async: ['async await', 'promises', 'callbacks', 'asynchronous programming'],
      database: ['SQL queries', 'NoSQL', 'database design', 'database optimization'],
      testing: ['unit testing', 'integration testing', 'test automation', 'TDD'],
    };

    const suggestions: string[] = [];

    for (const [key, values] of Object.entries(semanticMap)) {
      if (queryLower.includes(key) || key.includes(queryLower)) {
        suggestions.push(...values.filter((v) => !v.toLowerCase().includes(queryLower)));
      }
    }

    return suggestions.slice(0, 3);
  }

  private getQueryCompletions(query: string, context: SearchContext): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const words = query.toLowerCase().split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.length < 2) return suggestions;

    // Common programming terms and completions
    const commonCompletions = [
      'function',
      'variable',
      'method',
      'class',
      'interface',
      'type',
      'component',
      'hook',
      'state',
      'props',
      'event',
      'handler',
      'async',
      'await',
      'promise',
      'callback',
      'error',
      'exception',
      'array',
      'object',
      'string',
      'number',
      'boolean',
      'import',
      'export',
      'module',
      'package',
      'library',
      'test',
      'debug',
      'performance',
      'optimization',
      'authentication',
      'authorization',
      'security',
      'validation',
    ];

    commonCompletions
      .filter((term) => term.startsWith(lastWord) && term !== lastWord)
      .forEach((completion, index) => {
        const newQuery = [...words.slice(0, -1), completion].join(' ');
        suggestions.push({
          id: `completion-${index}`,
          text: newQuery,
          type: 'completion',
          score: 0.5 - index * 0.02,
          source: 'context',
          icon: '✨',
          description: `Complete with "${completion}"`,
        });
      });

    return suggestions.slice(0, 3);
  }

  private getDefaultSuggestions(context: SearchContext): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // Recent queries
    context.recentQueries.slice(0, 3).forEach((query, index) => {
      suggestions.push({
        id: `recent-${index}`,
        text: query,
        type: 'query',
        score: 0.8 - index * 0.1,
        source: 'history',
        icon: '🕒',
        description: 'Recent search',
      });
    });

    // Popular terms
    context.popularTerms.slice(0, 5).forEach((term, index) => {
      suggestions.push({
        id: `popular-default-${index}`,
        text: term.term,
        type: 'query',
        score: 0.6 - index * 0.05,
        source: 'popular',
        icon: '🔥',
        description: `Popular • ${term.count} searches`,
      });
    });

    // Common commands
    SEARCH_COMMANDS.slice(0, 3).forEach((cmd, index) => {
      suggestions.push({
        id: `command-default-${index}`,
        text: cmd.command,
        type: 'command',
        score: 0.4 - index * 0.05,
        source: 'context',
        icon: cmd.icon,
        description: cmd.description,
      });
    });

    return suggestions;
  }

  private rankAndFilterSuggestions(
    suggestions: SearchSuggestion[],
    context: SearchContext
  ): SearchSuggestion[] {
    // Remove duplicates
    const seen = new Set<string>();
    const unique = suggestions.filter((s) => {
      const key = s.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply contextual boosting
    if (this.options.contextualBoost) {
      unique.forEach((suggestion) => {
        // Boost suggestions that match active filters
        if (context.activeFilters && Object.keys(context.activeFilters).length > 0) {
          suggestion.score += 0.1;
        }

        // Boost recent suggestions
        if (suggestion.metadata?.lastUsed) {
          const daysSinceUsed =
            (Date.now() - suggestion.metadata.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceUsed < 7) {
            suggestion.score += 0.15 * Math.max(0, 1 - daysSinceUsed / 7);
          }
        }

        // Boost high-frequency suggestions
        if (suggestion.metadata?.frequency && suggestion.metadata.frequency > 5) {
          suggestion.score += 0.1;
        }
      });
    }

    // Sort by score and limit
    return unique.sort((a, b) => b.score - a.score).slice(0, this.options.maxSuggestions);
  }

  private buildCommandTrie(): void {
    SEARCH_COMMANDS.forEach((cmd) => {
      this.insertIntoTrie(cmd.command);
      cmd.examples.forEach((example) => {
        this.insertIntoTrie(example);
      });
    });
  }

  private insertIntoTrie(word: string): void {
    let node = this.trie;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    node.isEndOfWord = true;
    node.word = word;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Fuzzy matching utility
  fuzzyMatch(query: string, target: string): number {
    query = query.toLowerCase();
    target = target.toLowerCase();

    if (target.includes(query)) {
      return 1 - (target.length - query.length) / target.length;
    }

    // Simple fuzzy matching algorithm
    let score = 0;
    let queryIndex = 0;

    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        score++;
        queryIndex++;
      }
    }

    return queryIndex === query.length ? score / target.length : 0;
  }
}

class TrieNode {
  children = new Map<string, TrieNode>();
  isEndOfWord = false;
  word?: string;
}

// Real-time suggestion manager with debouncing
export class RealTimeSuggestionManager {
  private suggestionEngine: SearchSuggestionEngine;
  private debounceTimer: NodeJS.Timeout | null = null;
  private currentController: AbortController | null = null;

  constructor(options?: Partial<AutoCompleteOptions>) {
    this.suggestionEngine = new SearchSuggestionEngine(options);
  }

  async getSuggestions(context: SearchContext, debounceMs = 200): Promise<SearchSuggestion[]> {
    return new Promise((resolve, reject) => {
      // Cancel previous request
      if (this.currentController) {
        this.currentController.abort();
      }

      // Clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Create new abort controller
      this.currentController = new AbortController();
      const signal = this.currentController.signal;

      // Debounce the suggestion generation
      this.debounceTimer = setTimeout(async () => {
        try {
          if (signal.aborted) {
            reject(new Error('Request aborted'));
            return;
          }

          const suggestions = await this.suggestionEngine.generateSuggestions(context);

          if (!signal.aborted) {
            resolve(suggestions);
          }
        } catch (error) {
          if (!signal.aborted) {
            reject(error);
          }
        }
      }, debounceMs);
    });
  }

  cancel(): void {
    if (this.currentController) {
      this.currentController.abort();
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
