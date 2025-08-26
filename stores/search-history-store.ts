import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  SearchHistoryItem,
  SavedSearch,
  SearchAnalytics,
  SearchTrend,
  type SearchFilters,
} from '@/lib/search-history';

interface HistoryFilters {
  searchType: string;
  dateRange: string;
  query: string;
}

interface NewSavedSearch {
  name: string;
  description: string;
  tags: string;
}

interface SearchHistoryState {
  // UI State
  activeTab: 'history' | 'saved' | 'analytics';
  historyFilters: HistoryFilters;
  selectedItems: Set<string>;
  showCreateSaved: boolean;
  newSavedSearch: NewSavedSearch;
  
  // Raw Data State (persisted)
  history: SearchHistoryItem[];
  savedSearches: SavedSearch[];
  
  // Computed Data State (derived)
  searchHistory: SearchHistoryItem[];
  analytics: SearchAnalytics | null;
  trends: SearchTrend[];
  
  // Constants
  MAX_HISTORY_SIZE: number;
  
  // Actions
  setActiveTab: (tab: 'history' | 'saved' | 'analytics') => void;
  setHistoryFilters: (filters: HistoryFilters) => void;
  setSelectedItems: (items: Set<string>) => void;
  toggleItemSelection: (id: string) => void;
  clearSelection: () => void;
  setShowCreateSaved: (show: boolean) => void;
  setNewSavedSearch: (search: NewSavedSearch) => void;
  
  // Data actions (native Zustand)
  loadData: () => void;
  addSearchToHistory: (searchData: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => void;
  bookmarkSearch: (id: string, bookmarked: boolean) => void;
  deleteHistoryItem: (id: string) => void;
  deleteSavedSearch: (id: string) => void;
  bulkDelete: () => void;
  createSavedSearch: () => void;
  executeSavedSearch: (savedSearch: SavedSearch) => void;
  
  // Analytics functions (native implementation)
  computeAnalytics: (dateRange?: { start: Date; end: Date }) => SearchAnalytics;
  computeTrends: (days?: number) => SearchTrend[];
  getFilteredHistory: (options?: {
    limit?: number;
    searchType?: string;
    dateRange?: { start: Date; end: Date };
    query?: string;
  }) => SearchHistoryItem[];
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial UI State
        activeTab: 'history',
        historyFilters: {
          searchType: '',
          dateRange: '',
          query: '',
        },
        selectedItems: new Set(),
        showCreateSaved: false,
        newSavedSearch: {
          name: '',
          description: '',
          tags: '',
        },
        
        // Raw Data State (persisted in localStorage)
        history: [],
        savedSearches: [],
        
        // Computed Data State (derived)
        searchHistory: [],
        analytics: null,
        trends: [],
        
        // Constants
        MAX_HISTORY_SIZE: 1000,
        
        // Helper functions (native implementation)
        getFilteredHistory: (options = {}) => {
          const { history } = get();
          let filtered = [...history];

          if (options.searchType) {
            filtered = filtered.filter((item) => item.searchType === options.searchType);
          }

          if (options.dateRange) {
            filtered = filtered.filter(
              (item) =>
                item.timestamp >= options.dateRange!.start && 
                item.timestamp <= options.dateRange!.end
            );
          }

          if (options.query) {
            const queryLower = options.query.toLowerCase();
            filtered = filtered.filter((item) => 
              item.query.toLowerCase().includes(queryLower)
            );
          }

          if (options.limit) {
            filtered = filtered.slice(0, options.limit);
          }

          return filtered;
        },
        
        computeAnalytics: (dateRange) => {
          const { history } = get();
          let searchHistory = dateRange 
            ? history.filter(
                (item) => item.timestamp >= dateRange.start && item.timestamp <= dateRange.end
              )
            : history;

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
              h.resultsCount === 0 ? '0' :
              h.resultsCount <= 5 ? '1-5' :
              h.resultsCount <= 10 ? '6-10' :
              h.resultsCount <= 25 ? '11-25' : '25+';
            resultCountDistribution[bucket] = (resultCountDistribution[bucket] || 0) + 1;
          });

          // Time distribution (hourly)
          const timeDistribution: Record<string, number> = {};
          searchHistory.forEach((h) => {
            const hour = h.timestamp.getHours().toString().padStart(2, '0');
            timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
          });

          // Top sources and languages
          const sourceCounts = new Map<string, number>();
          const languageCounts = new Map<string, number>();
          
          searchHistory.forEach((h) => {
            h.results?.forEach((result) => {
              sourceCounts.set(result.source, (sourceCounts.get(result.source) || 0) + 1);
              if (result.language) {
                languageCounts.set(result.language, (languageCounts.get(result.language) || 0) + 1);
              }
            });
          });

          const topSources = Array.from(sourceCounts.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

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
        },
        
        computeTrends: (days = 30) => {
          const { history } = get();
          const trends: SearchTrend[] = [];
          const now = new Date();

          for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const daySearches = history.filter(
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
        },
        
        // UI Actions
        setActiveTab: (tab) => {
          set({ activeTab: tab }, false, 'search-history/setActiveTab');
          // Auto-load data when tab changes
          get().loadData();
        },
        
        setHistoryFilters: (filters) => 
          set({ historyFilters: filters }, false, 'search-history/setHistoryFilters'),
          
        setSelectedItems: (items) => 
          set({ selectedItems: items }, false, 'search-history/setSelectedItems'),
          
        toggleItemSelection: (id) => {
          const { selectedItems } = get();
          const newSelected = new Set(selectedItems);
          if (newSelected.has(id)) {
            newSelected.delete(id);
          } else {
            newSelected.add(id);
          }
          set({ selectedItems: newSelected }, false, 'search-history/toggleItemSelection');
        },
        
        clearSelection: () => 
          set({ selectedItems: new Set() }, false, 'search-history/clearSelection'),
          
        setShowCreateSaved: (show) => 
          set({ showCreateSaved: show }, false, 'search-history/setShowCreateSaved'),
          
        setNewSavedSearch: (search) => 
          set({ newSavedSearch: search }, false, 'search-history/setNewSavedSearch'),
        
        // Data Actions (native Zustand implementation)
        loadData: () => {
          const { activeTab, historyFilters, getFilteredHistory, computeAnalytics, computeTrends } = get();
          
          if (activeTab === 'history') {
            const searchHistory = getFilteredHistory({
              limit: 100,
              searchType: historyFilters.searchType || undefined,
              query: historyFilters.query || undefined,
            });
            set({ searchHistory }, false, 'search-history/loadHistory');
          } else if (activeTab === 'saved') {
            // savedSearches are already in state, no need to reload
          } else if (activeTab === 'analytics') {
            const analytics = computeAnalytics();
            const trends = computeTrends(30);
            set({ analytics, trends }, false, 'search-history/loadAnalytics');
          }
        },
        
        addSearchToHistory: (searchData) => {
          const { history, MAX_HISTORY_SIZE } = get();
          
          const item: SearchHistoryItem = {
            ...searchData,
            id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
          };

          const newHistory = [item, ...history];
          
          // Limit history size
          if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.length = MAX_HISTORY_SIZE;
          }

          set({ history: newHistory }, false, 'search-history/addSearch');
          
          // Reload data if we're on the history tab
          if (get().activeTab === 'history') {
            get().loadData();
          }
        },
        
        bookmarkSearch: (id, bookmarked) => {
          const { history } = get();
          const newHistory = history.map(item => 
            item.id === id ? { ...item, bookmarked } : item
          );
          set({ history: newHistory }, false, 'search-history/bookmarkSearch');
          get().loadData();
        },
        
        deleteHistoryItem: (id) => {
          const { history } = get();
          const newHistory = history.filter(item => item.id !== id);
          set({ history: newHistory }, false, 'search-history/deleteHistoryItem');
          get().loadData();
        },
        
        deleteSavedSearch: (id) => {
          const { savedSearches } = get();
          const newSavedSearches = savedSearches.filter(search => search.id !== id);
          set({ savedSearches: newSavedSearches }, false, 'search-history/deleteSavedSearch');
        },
        
        bulkDelete: () => {
          const { selectedItems, activeTab, history, savedSearches } = get();
          
          if (activeTab === 'history') {
            const newHistory = history.filter(item => !selectedItems.has(item.id));
            set({ history: newHistory }, false, 'search-history/bulkDeleteHistory');
          } else if (activeTab === 'saved') {
            const newSavedSearches = savedSearches.filter(search => !selectedItems.has(search.id));
            set({ savedSearches: newSavedSearches }, false, 'search-history/bulkDeleteSaved');
          }
          
          set({ selectedItems: new Set() }, false, 'search-history/clearSelectionAfterBulkDelete');
          get().loadData();
        },
        
        createSavedSearch: () => {
          const { newSavedSearch, savedSearches } = get();
          
          if (!newSavedSearch.name.trim()) return;

          const saved: SavedSearch = {
            id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: newSavedSearch.name,
            query: 'example query', // Would come from selected history item
            filters: {},
            searchType: 'semantic' as const,
            description: newSavedSearch.description,
            tags: newSavedSearch.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            createdAt: new Date(),
            executionCount: 0,
            averageResults: 0,
          };

          const newSavedSearches = [...savedSearches, saved];
          
          set({ 
            savedSearches: newSavedSearches,
            newSavedSearch: { name: '', description: '', tags: '' },
            showCreateSaved: false 
          }, false, 'search-history/createSavedSearch');
        },
        
        executeSavedSearch: (savedSearch) => {
          const { savedSearches } = get();
          const newSavedSearches = savedSearches.map(search => 
            search.id === savedSearch.id 
              ? {
                  ...search,
                  lastExecuted: new Date(),
                  executionCount: search.executionCount + 1,
                  averageResults: Math.round(
                    (search.averageResults * search.executionCount + 0) / (search.executionCount + 1)
                  )
                }
              : search
          );
          set({ savedSearches: newSavedSearches }, false, 'search-history/executeSavedSearch');
        },
      }),
      {
        name: 'search-history-store',
        partialize: (state) => ({
          // Persist UI preferences and raw data
          activeTab: state.activeTab,
          historyFilters: state.historyFilters,
          showCreateSaved: state.showCreateSaved,
          newSavedSearch: state.newSavedSearch,
          history: state.history,
          savedSearches: state.savedSearches,
        }),
        // Handle Date serialization/deserialization
        serialize: (state) => {
          const serialized = JSON.stringify({
            ...state,
            history: state.history.map(item => ({
              ...item,
              timestamp: item.timestamp.toISOString()
            })),
            savedSearches: state.savedSearches.map(search => ({
              ...search,
              createdAt: search.createdAt.toISOString(),
              lastExecuted: search.lastExecuted?.toISOString()
            }))
          });
          return serialized;
        },
        deserialize: (str) => {
          const parsed = JSON.parse(str);
          return {
            ...parsed,
            history: (parsed.history || []).map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp)
            })),
            savedSearches: (parsed.savedSearches || []).map((search: any) => ({
              ...search,
              createdAt: new Date(search.createdAt),
              lastExecuted: search.lastExecuted ? new Date(search.lastExecuted) : undefined
            }))
          };
        }
      }
    ),
    {
      name: 'search-history-store',
    }
  )
);