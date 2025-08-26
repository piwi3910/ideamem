import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface SearchResult {
  id: string;
  score: number;
  content: string;
  source: string;
  projectId?: string;
  projectName?: string;
  repository?: string;
  language?: string;
  metadata?: Record<string, any>;
}

interface SearchFilters {
  languages?: string[];
  repositories?: string[];
  projects?: string[];
  content_types?: string[];
  complexity?: string[];
  date_range?: {
    from?: Date;
    to?: Date;
  };
  score_threshold?: number;
}

interface SearchState {
  // Current search state
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  filters: SearchFilters;
  selectedResult: SearchResult | null;
  
  // Search history and saved searches
  searchHistory: Array<{
    query: string;
    timestamp: Date;
    resultsCount: number;
    filters?: SearchFilters;
  }>;
  savedSearches: Array<{
    id: string;
    name: string;
    query: string;
    filters?: SearchFilters;
    createdAt: Date;
  }>;
  
  // UI state
  showAdvancedFilters: boolean;
  searchMode: 'simple' | 'advanced' | 'faceted';
  groupBy: 'none' | 'project' | 'language' | 'type';
  sortBy: 'relevance' | 'date' | 'project' | 'alphabetical';
  
  // Faceted search state
  facets: {
    languages: Array<{ value: string; count: number; selected: boolean }>;
    repositories: Array<{ value: string; count: number; selected: boolean }>;
    content_types: Array<{ value: string; count: number; selected: boolean }>;
    complexity: Array<{ value: string; count: number; selected: boolean }>;
  };
  
  // Auto-complete and suggestions
  suggestions: string[];
  recentQueries: string[];
  
  // Actions
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: (key: keyof SearchFilters, value: any) => void;
  clearFilters: () => void;
  setSelectedResult: (result: SearchResult | null) => void;
  
  addToHistory: (query: string, resultsCount: number, filters?: SearchFilters) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
  
  saveSearch: (name: string, query?: string, filters?: SearchFilters) => void;
  removeSavedSearch: (id: string) => void;
  loadSavedSearch: (id: string) => void;
  
  setShowAdvancedFilters: (show: boolean) => void;
  setSearchMode: (mode: 'simple' | 'advanced' | 'faceted') => void;
  setGroupBy: (groupBy: 'none' | 'project' | 'language' | 'type') => void;
  setSortBy: (sortBy: 'relevance' | 'date' | 'project' | 'alphabetical') => void;
  
  updateFacets: (facets: SearchState['facets']) => void;
  toggleFacetSelection: (category: keyof SearchState['facets'], value: string) => void;
  clearFacetSelections: () => void;
  
  setSuggestions: (suggestions: string[]) => void;
  addRecentQuery: (query: string) => void;
  clearRecentQueries: () => void;
  
  reset: () => void;
}

const initialFilters: SearchFilters = {};

const initialFacets = {
  languages: [],
  repositories: [],
  content_types: [],
  complexity: [],
};

export const useSearchStore = create<SearchState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        query: '',
        results: [],
        isSearching: false,
        error: null,
        filters: initialFilters,
        selectedResult: null,
        
        searchHistory: [],
        savedSearches: [],
        
        showAdvancedFilters: false,
        searchMode: 'simple',
        groupBy: 'none',
        sortBy: 'relevance',
        
        facets: initialFacets,
        
        suggestions: [],
        recentQueries: [],

        // Actions
        setQuery: (query: string) =>
          set({ query }, false, 'search/setQuery'),

        setResults: (results: SearchResult[]) =>
          set({ results, error: null }, false, 'search/setResults'),

        setIsSearching: (isSearching: boolean) =>
          set({ isSearching }, false, 'search/setIsSearching'),

        setError: (error: string | null) =>
          set({ error, isSearching: false }, false, 'search/setError'),

        setFilters: (filters: SearchFilters) =>
          set({ filters }, false, 'search/setFilters'),

        updateFilter: (key: keyof SearchFilters, value: any) =>
          set((state) => ({
            filters: { ...state.filters, [key]: value }
          }), false, 'search/updateFilter'),

        clearFilters: () =>
          set({ filters: initialFilters }, false, 'search/clearFilters'),

        setSelectedResult: (selectedResult: SearchResult | null) =>
          set({ selectedResult }, false, 'search/setSelectedResult'),

        addToHistory: (query: string, resultsCount: number, filters?: SearchFilters) =>
          set((state) => ({
            searchHistory: [
              { query, timestamp: new Date(), resultsCount, filters },
              ...state.searchHistory.slice(0, 49) // Keep last 50 searches
            ]
          }), false, 'search/addToHistory'),

        clearHistory: () =>
          set({ searchHistory: [] }, false, 'search/clearHistory'),

        removeFromHistory: (index: number) =>
          set((state) => ({
            searchHistory: state.searchHistory.filter((_, i) => i !== index)
          }), false, 'search/removeFromHistory'),

        saveSearch: (name: string, query?: string, filters?: SearchFilters) =>
          set((state) => ({
            savedSearches: [
              {
                id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name,
                query: query || state.query,
                filters: filters || state.filters,
                createdAt: new Date(),
              },
              ...state.savedSearches
            ]
          }), false, 'search/saveSearch'),

        removeSavedSearch: (id: string) =>
          set((state) => ({
            savedSearches: state.savedSearches.filter(s => s.id !== id)
          }), false, 'search/removeSavedSearch'),

        loadSavedSearch: (id: string) =>
          set((state) => {
            const savedSearch = state.savedSearches.find(s => s.id === id);
            if (savedSearch) {
              return {
                query: savedSearch.query,
                filters: savedSearch.filters || initialFilters,
              };
            }
            return {};
          }, false, 'search/loadSavedSearch'),

        setShowAdvancedFilters: (showAdvancedFilters: boolean) =>
          set({ showAdvancedFilters }, false, 'search/setShowAdvancedFilters'),

        setSearchMode: (searchMode: 'simple' | 'advanced' | 'faceted') =>
          set({ searchMode }, false, 'search/setSearchMode'),

        setGroupBy: (groupBy: 'none' | 'project' | 'language' | 'type') =>
          set({ groupBy }, false, 'search/setGroupBy'),

        setSortBy: (sortBy: 'relevance' | 'date' | 'project' | 'alphabetical') =>
          set({ sortBy }, false, 'search/setSortBy'),

        updateFacets: (facets: SearchState['facets']) =>
          set({ facets }, false, 'search/updateFacets'),

        toggleFacetSelection: (category: keyof SearchState['facets'], value: string) =>
          set((state) => ({
            facets: {
              ...state.facets,
              [category]: state.facets[category].map(item =>
                item.value === value 
                  ? { ...item, selected: !item.selected }
                  : item
              )
            }
          }), false, 'search/toggleFacetSelection'),

        clearFacetSelections: () =>
          set((state) => ({
            facets: Object.keys(state.facets).reduce((acc, key) => ({
              ...acc,
              [key]: state.facets[key as keyof typeof state.facets].map(item => 
                ({ ...item, selected: false })
              )
            }), {} as SearchState['facets'])
          }), false, 'search/clearFacetSelections'),

        setSuggestions: (suggestions: string[]) =>
          set({ suggestions }, false, 'search/setSuggestions'),

        addRecentQuery: (query: string) =>
          set((state) => ({
            recentQueries: [
              query,
              ...state.recentQueries.filter(q => q !== query).slice(0, 9) // Keep last 10 unique queries
            ]
          }), false, 'search/addRecentQuery'),

        clearRecentQueries: () =>
          set({ recentQueries: [] }, false, 'search/clearRecentQueries'),

        reset: () =>
          set({
            query: '',
            results: [],
            isSearching: false,
            error: null,
            filters: initialFilters,
            selectedResult: null,
            showAdvancedFilters: false,
            facets: initialFacets,
          }, false, 'search/reset'),
      }),
      {
        name: 'search-store',
        partialize: (state) => ({
          searchHistory: state.searchHistory,
          savedSearches: state.savedSearches,
          recentQueries: state.recentQueries,
          showAdvancedFilters: state.showAdvancedFilters,
          searchMode: state.searchMode,
          groupBy: state.groupBy,
          sortBy: state.sortBy,
        }),
      }
    ),
    {
      name: 'search-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);