export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  resultsCount: number;
  executionTime: number;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  filters?: SearchFilters;
  results?: SearchResult[];
  bookmarked?: boolean;
  tags?: string[];
  notes?: string;
}

export interface SearchFilters {
  type?: string[];
  language?: string[];
  source?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  minScore?: number;
  projectId?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  source: string;
  type: string;
  language?: string;
  metadata?: Record<string, any>;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  searchType: 'semantic' | 'keyword' | 'hybrid';
  createdAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  averageResults: number;
  tags?: string[];
  description?: string;
  notifications?: boolean;
  schedule?: SearchSchedule;
}

export interface SearchSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  lastRun?: Date;
  nextRun?: Date;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueQueries: number;
  averageExecutionTime: number;
  mostSearchedTerms: Array<{ term: string; count: number }>;
  searchTypeDistribution: Record<string, number>;
  resultCountDistribution: Record<string, number>;
  timeDistribution: Record<string, number>; // hourly distribution
  topSources: Array<{ source: string; count: number }>;
  topLanguages: Array<{ language: string; count: number }>;
}

export interface SearchTrend {
  date: string;
  searchCount: number;
  uniqueQueries: number;
  averageResults: number;
  averageExecutionTime: number;
}

export class SearchHistoryManager {
  private history: SearchHistoryItem[] = [];
  private savedSearches: SavedSearch[] = [];
  private readonly STORAGE_KEY = 'search-history';
  private readonly SAVED_SEARCHES_KEY = 'saved-searches';
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor() {
    this.loadFromStorage();
  }

  // History Management
  addSearch(searchData: Omit<SearchHistoryItem, 'id' | 'timestamp'>): SearchHistoryItem {
    const item: SearchHistoryItem = {
      ...searchData,
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.history.unshift(item);

    // Limit history size
    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, this.MAX_HISTORY_SIZE);
    }

    this.saveToStorage();
    return item;
  }

  getHistory(options?: {
    limit?: number;
    searchType?: string;
    dateRange?: { start: Date; end: Date };
    query?: string;
  }): SearchHistoryItem[] {
    let filtered = [...this.history];

    if (options?.searchType) {
      filtered = filtered.filter((item) => item.searchType === options.searchType);
    }

    if (options?.dateRange) {
      filtered = filtered.filter(
        (item) =>
          item.timestamp >= options.dateRange!.start && item.timestamp <= options.dateRange!.end
      );
    }

    if (options?.query) {
      const queryLower = options.query.toLowerCase();
      filtered = filtered.filter((item) => item.query.toLowerCase().includes(queryLower));
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  deleteHistoryItem(id: string): boolean {
    const index = this.history.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.history.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.history = [];
    this.saveToStorage();
  }

  bookmarkSearch(id: string, bookmarked = true): boolean {
    const item = this.history.find((h) => h.id === id);
    if (item) {
      item.bookmarked = bookmarked;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  addNoteToSearch(id: string, notes: string): boolean {
    const item = this.history.find((h) => h.id === id);
    if (item) {
      item.notes = notes;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  tagSearch(id: string, tags: string[]): boolean {
    const item = this.history.find((h) => h.id === id);
    if (item) {
      item.tags = tags;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Saved Searches Management
  saveSearch(
    searchData: Omit<SavedSearch, 'id' | 'createdAt' | 'executionCount' | 'averageResults'>
  ): SavedSearch {
    const saved: SavedSearch = {
      ...searchData,
      id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      executionCount: 0,
      averageResults: 0,
    };

    this.savedSearches.push(saved);
    this.saveSavedSearches();
    return saved;
  }

  getSavedSearches(): SavedSearch[] {
    return [...this.savedSearches];
  }

  deleteSavedSearch(id: string): boolean {
    const index = this.savedSearches.findIndex((s) => s.id === id);
    if (index >= 0) {
      this.savedSearches.splice(index, 1);
      this.saveSavedSearches();
      return true;
    }
    return false;
  }

  updateSavedSearch(id: string, updates: Partial<SavedSearch>): boolean {
    const saved = this.savedSearches.find((s) => s.id === id);
    if (saved) {
      Object.assign(saved, updates);
      this.saveSavedSearches();
      return true;
    }
    return false;
  }

  executeSavedSearch(id: string, resultsCount: number): boolean {
    const saved = this.savedSearches.find((s) => s.id === id);
    if (saved) {
      saved.lastExecuted = new Date();
      saved.executionCount++;
      saved.averageResults = Math.round(
        (saved.averageResults * (saved.executionCount - 1) + resultsCount) / saved.executionCount
      );
      this.saveSavedSearches();
      return true;
    }
    return false;
  }

  // Analytics
  getAnalytics(dateRange?: { start: Date; end: Date }): SearchAnalytics {
    let searchHistory = this.history;

    if (dateRange) {
      searchHistory = searchHistory.filter(
        (item) => item.timestamp >= dateRange.start && item.timestamp <= dateRange.end
      );
    }

    const totalSearches = searchHistory.length;
    const uniqueQueries = new Set(searchHistory.map((h) => h.query.toLowerCase())).size;
    const averageExecutionTime =
      searchHistory.reduce((sum, h) => sum + h.executionTime, 0) / totalSearches || 0;

    // Most searched terms
    const termCounts = new Map<string, number>();
    searchHistory.forEach((h) => {
      const normalizedQuery = h.query.toLowerCase().trim();
      termCounts.set(normalizedQuery, (termCounts.get(normalizedQuery) || 0) + 1);
    });

    const mostSearchedTerms = Array.from(termCounts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Search type distribution
    const searchTypeDistribution: Record<string, number> = {};
    searchHistory.forEach((h) => {
      searchTypeDistribution[h.searchType] = (searchTypeDistribution[h.searchType] || 0) + 1;
    });

    // Result count distribution
    const resultCountDistribution: Record<string, number> = {};
    searchHistory.forEach((h) => {
      const bucket =
        h.resultsCount === 0
          ? '0'
          : h.resultsCount <= 5
            ? '1-5'
            : h.resultsCount <= 10
              ? '6-10'
              : h.resultsCount <= 25
                ? '11-25'
                : '25+';
      resultCountDistribution[bucket] = (resultCountDistribution[bucket] || 0) + 1;
    });

    // Time distribution (hourly)
    const timeDistribution: Record<string, number> = {};
    searchHistory.forEach((h) => {
      const hour = h.timestamp.getHours().toString().padStart(2, '0');
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    });

    // Top sources
    const sourceCounts = new Map<string, number>();
    searchHistory.forEach((h) => {
      h.results?.forEach((result) => {
        sourceCounts.set(result.source, (sourceCounts.get(result.source) || 0) + 1);
      });
    });

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top languages
    const languageCounts = new Map<string, number>();
    searchHistory.forEach((h) => {
      h.results?.forEach((result) => {
        if (result.language) {
          languageCounts.set(result.language, (languageCounts.get(result.language) || 0) + 1);
        }
      });
    });

    const topLanguages = Array.from(languageCounts.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSearches,
      uniqueQueries,
      averageExecutionTime,
      mostSearchedTerms,
      searchTypeDistribution,
      resultCountDistribution,
      timeDistribution,
      topSources,
      topLanguages,
    };
  }

  getTrends(days = 30): SearchTrend[] {
    const trends: SearchTrend[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const daySearches = this.history.filter(
        (h) => h.timestamp.toISOString().split('T')[0] === dateStr
      );

      const uniqueQueries = new Set(daySearches.map((h) => h.query.toLowerCase())).size;
      const averageResults =
        daySearches.length > 0
          ? daySearches.reduce((sum, h) => sum + h.resultsCount, 0) / daySearches.length
          : 0;
      const averageExecutionTime =
        daySearches.length > 0
          ? daySearches.reduce((sum, h) => sum + h.executionTime, 0) / daySearches.length
          : 0;

      trends.push({
        date: dateStr,
        searchCount: daySearches.length,
        uniqueQueries,
        averageResults,
        averageExecutionTime,
      });
    }

    return trends;
  }

  // Similar queries
  findSimilarQueries(query: string, limit = 5): SearchHistoryItem[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const scored = this.history
      .filter((h) => h.query.toLowerCase() !== queryLower)
      .map((h) => {
        const historyWords = h.query.toLowerCase().split(/\s+/);
        const commonWords = queryWords.filter((word) => historyWords.includes(word));
        const score = commonWords.length / Math.max(queryWords.length, historyWords.length);
        return { item: h, score };
      })
      .filter(({ score }) => score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ item }) => item);
  }

  // Export/Import
  exportHistory(): string {
    return JSON.stringify(
      {
        history: this.history,
        savedSearches: this.savedSearches,
        exportDate: new Date().toISOString(),
      },
      null,
      2
    );
  }

  importHistory(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (parsed.history && Array.isArray(parsed.history)) {
        this.history = parsed.history.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
      }
      if (parsed.savedSearches && Array.isArray(parsed.savedSearches)) {
        this.savedSearches = parsed.savedSearches.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastExecuted: s.lastExecuted ? new Date(s.lastExecuted) : undefined,
        }));
      }
      this.saveToStorage();
      this.saveSavedSearches();
      return true;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }

  // Storage
  private loadFromStorage(): void {
    try {
      const historyData = localStorage.getItem(this.STORAGE_KEY);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.history = parsed.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
      }

      const savedData = localStorage.getItem(this.SAVED_SEARCHES_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        this.savedSearches = parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastExecuted: s.lastExecuted ? new Date(s.lastExecuted) : undefined,
        }));
      }
    } catch (error) {
      console.error('Failed to load search history from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save search history to storage:', error);
    }
  }

  private saveSavedSearches(): void {
    try {
      localStorage.setItem(this.SAVED_SEARCHES_KEY, JSON.stringify(this.savedSearches));
    } catch (error) {
      console.error('Failed to save saved searches to storage:', error);
    }
  }
}

// Utility functions
export function formatSearchDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function generateSearchSuggestions(
  query: string,
  history: SearchHistoryItem[],
  limit = 5
): string[] {
  const queryLower = query.toLowerCase();

  if (queryLower.length < 2) return [];

  const suggestions = new Set<string>();

  // Add matches from history
  history.forEach((h) => {
    const historyQuery = h.query.toLowerCase();
    if (historyQuery.startsWith(queryLower) && historyQuery !== queryLower) {
      suggestions.add(h.query);
    }
  });

  // Add partial matches
  if (suggestions.size < limit) {
    history.forEach((h) => {
      const historyQuery = h.query.toLowerCase();
      if (historyQuery.includes(queryLower) && historyQuery !== queryLower) {
        suggestions.add(h.query);
      }
    });
  }

  return Array.from(suggestions).slice(0, limit);
}
