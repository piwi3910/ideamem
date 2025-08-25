'use client';

import { useState, useEffect } from 'react';
import {
  SearchHistoryManager,
  SearchHistoryItem,
  SavedSearch,
  SearchAnalytics,
  SearchTrend,
  formatSearchDuration,
  formatRelativeTime,
} from '../lib/search-history';

export interface SearchHistoryProps {
  onSearchSelect?: (query: string, filters?: any) => void;
  onSavedSearchExecute?: (savedSearch: SavedSearch) => void;
  className?: string;
  theme?: 'light' | 'dark';
}

export default function SearchHistory({
  onSearchSelect,
  onSavedSearchExecute,
  className = '',
  theme = 'light',
}: SearchHistoryProps) {
  const [historyManager] = useState(() => new SearchHistoryManager());
  const [activeTab, setActiveTab] = useState<'history' | 'saved' | 'analytics'>('history');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [trends, setTrends] = useState<SearchTrend[]>([]);

  const [historyFilters, setHistoryFilters] = useState({
    searchType: '',
    dateRange: '',
    query: '',
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateSaved, setShowCreateSaved] = useState(false);
  const [newSavedSearch, setNewSavedSearch] = useState({
    name: '',
    description: '',
    tags: '' as string,
  });

  const themeClasses = {
    light: 'bg-white text-gray-900 border-gray-200',
    dark: 'bg-gray-800 text-gray-100 border-gray-700',
  };

  // Load data on mount and when tab changes
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = () => {
    if (activeTab === 'history') {
      const history = historyManager.getHistory({
        limit: 100,
        searchType: historyFilters.searchType || undefined,
        query: historyFilters.query || undefined,
      });
      setSearchHistory(history);
    } else if (activeTab === 'saved') {
      const saved = historyManager.getSavedSearches();
      setSavedSearches(saved);
    } else if (activeTab === 'analytics') {
      const analyticsData = historyManager.getAnalytics();
      const trendsData = historyManager.getTrends(30);
      setAnalytics(analyticsData);
      setTrends(trendsData);
    }
  };

  const handleHistoryItemSelect = (item: SearchHistoryItem) => {
    onSearchSelect?.(item.query, item.filters);
  };

  const handleSavedSearchExecute = (savedSearch: SavedSearch) => {
    onSavedSearchExecute?.(savedSearch);
    historyManager.executeSavedSearch(savedSearch.id, 0); // Will be updated with actual results
    loadData();
  };

  const handleBookmarkToggle = (id: string, bookmarked: boolean) => {
    historyManager.bookmarkSearch(id, bookmarked);
    loadData();
  };

  const handleDeleteHistory = (id: string) => {
    historyManager.deleteHistoryItem(id);
    loadData();
  };

  const handleDeleteSaved = (id: string) => {
    historyManager.deleteSavedSearch(id);
    loadData();
  };

  const handleBulkDelete = () => {
    selectedItems.forEach((id) => {
      if (activeTab === 'history') {
        historyManager.deleteHistoryItem(id);
      } else if (activeTab === 'saved') {
        historyManager.deleteSavedSearch(id);
      }
    });
    setSelectedItems(new Set());
    loadData();
  };

  const handleCreateSavedSearch = () => {
    if (!newSavedSearch.name.trim()) return;

    // This would typically be populated from a selected history item
    const mockSavedSearch = {
      name: newSavedSearch.name,
      query: 'example query', // Would come from selected history item
      filters: {},
      searchType: 'semantic' as const,
      description: newSavedSearch.description,
      tags: newSavedSearch.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    historyManager.saveSearch(mockSavedSearch);
    setNewSavedSearch({ name: '', description: '', tags: '' });
    setShowCreateSaved(false);
    loadData();
  };

  const renderTabButton = (tab: typeof activeTab, label: string, icon: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
        ${
          activeTab === tab
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }
      `}
    >
      <span>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className={`${className} ${themeClasses[theme]} rounded-lg border p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Search History & Analytics</h2>

        {/* Tabs */}
        <div className="flex gap-2">
          {renderTabButton('history', 'History', '📝')}
          {renderTabButton('saved', 'Saved', '⭐')}
          {renderTabButton('analytics', 'Analytics', '📊')}
        </div>
      </div>

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={historyFilters.query}
                onChange={(e) => setHistoryFilters({ ...historyFilters, query: e.target.value })}
                placeholder="Filter by query..."
                className={`
                  w-full px-3 py-2 rounded border
                  ${
                    theme === 'dark'
                      ? 'bg-gray-600 border-gray-500 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
              />
            </div>

            <select
              value={historyFilters.searchType}
              onChange={(e) => setHistoryFilters({ ...historyFilters, searchType: e.target.value })}
              className={`
                px-3 py-2 rounded border
                ${
                  theme === 'dark'
                    ? 'bg-gray-600 border-gray-500 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
            >
              <option value="">All Types</option>
              <option value="semantic">Semantic</option>
              <option value="keyword">Keyword</option>
              <option value="hybrid">Hybrid</option>
            </select>

            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <span className="text-sm">
                {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* History List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className={`
                  p-4 border rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-700
                  ${selectedItems.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-600'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedItems);
                        if (e.target.checked) {
                          newSelected.add(item.id);
                        } else {
                          newSelected.delete(item.id);
                        }
                        setSelectedItems(newSelected);
                      }}
                      className="mt-1"
                    />

                    <div className="flex-1">
                      <button
                        onClick={() => handleHistoryItemSelect(item)}
                        className="text-left w-full"
                      >
                        <div className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          {item.query}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {formatRelativeTime(item.timestamp)} •{item.resultsCount} results •
                          {formatSearchDuration(item.executionTime)} •{item.searchType}
                          {item.tags && item.tags.length > 0 && (
                            <span className="ml-2">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs ml-1"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                            "{item.notes}"
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleBookmarkToggle(item.id, !item.bookmarked)}
                      className={`
                        p-1 rounded transition-colors
                        ${
                          item.bookmarked
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-400 hover:text-yellow-500'
                        }
                      `}
                      title={item.bookmarked ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      ⭐
                    </button>

                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Delete from history"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {searchHistory.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No search history found. Start searching to build your history.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saved Searches Tab */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Saved Searches</h3>
            <button
              onClick={() => setShowCreateSaved(!showCreateSaved)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Saved Search
            </button>
          </div>

          {/* Create Saved Search Form */}
          {showCreateSaved && (
            <div className="p-4 border border-blue-300 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <h4 className="font-medium mb-3">Create New Saved Search</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newSavedSearch.name}
                  onChange={(e) => setNewSavedSearch({ ...newSavedSearch, name: e.target.value })}
                  placeholder="Search name..."
                  className={`
                    w-full px-3 py-2 rounded border
                    ${
                      theme === 'dark'
                        ? 'bg-gray-600 border-gray-500 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  `}
                />

                <textarea
                  value={newSavedSearch.description}
                  onChange={(e) =>
                    setNewSavedSearch({ ...newSavedSearch, description: e.target.value })
                  }
                  placeholder="Optional description..."
                  rows={2}
                  className={`
                    w-full px-3 py-2 rounded border
                    ${
                      theme === 'dark'
                        ? 'bg-gray-600 border-gray-500 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  `}
                />

                <input
                  type="text"
                  value={newSavedSearch.tags}
                  onChange={(e) => setNewSavedSearch({ ...newSavedSearch, tags: e.target.value })}
                  placeholder="Tags (comma-separated)..."
                  className={`
                    w-full px-3 py-2 rounded border
                    ${
                      theme === 'dark'
                        ? 'bg-gray-600 border-gray-500 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                  `}
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSavedSearch}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateSaved(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Saved Searches List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {savedSearches.map((saved) => (
              <div
                key={saved.id}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{saved.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">"{saved.query}"</p>
                    {saved.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {saved.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>Created: {formatRelativeTime(saved.createdAt)}</span>
                      <span>Executed: {saved.executionCount} times</span>
                      {saved.lastExecuted && (
                        <span>Last: {formatRelativeTime(saved.lastExecuted)}</span>
                      )}
                      <span>Avg Results: {saved.averageResults}</span>
                    </div>
                    {saved.tags && saved.tags.length > 0 && (
                      <div className="mt-2">
                        {saved.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs mr-1"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleSavedSearchExecute(saved)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Execute
                    </button>

                    <button
                      onClick={() => handleDeleteSaved(saved.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Delete saved search"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {savedSearches.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No saved searches yet. Create your first saved search to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.totalSearches}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Searches</div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {analytics.uniqueQueries}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Unique Queries</div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatSearchDuration(analytics.averageExecutionTime)}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Avg Duration</div>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analytics.mostSearchedTerms.length > 0 ? analytics.mostSearchedTerms[0].count : 0}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">Top Query Count</div>
            </div>
          </div>

          {/* Most Searched Terms */}
          <div>
            <h4 className="text-lg font-medium mb-3">Most Searched Terms</h4>
            <div className="space-y-2">
              {analytics.mostSearchedTerms.slice(0, 10).map((term, index) => (
                <div
                  key={term.term}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
                      #{index + 1}
                    </span>
                    <span className="font-medium">{term.term}</span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {term.count} searches
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Search Type Distribution */}
          <div>
            <h4 className="text-lg font-medium mb-3">Search Type Distribution</h4>
            <div className="space-y-2">
              {Object.entries(analytics.searchTypeDistribution).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <span className="capitalize font-medium">{type}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {count} ({Math.round((count / analytics.totalSearches) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trends Chart (Simple visualization) */}
          <div>
            <h4 className="text-lg font-medium mb-3">Search Trends (Last 30 Days)</h4>
            <div className="h-64 flex items-end gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              {trends.map((trend, index) => {
                const maxSearches = Math.max(...trends.map((t) => t.searchCount));
                const height = maxSearches > 0 ? (trend.searchCount / maxSearches) * 100 : 0;

                return (
                  <div
                    key={trend.date}
                    className="flex-1 bg-blue-500 rounded-t min-h-[2px] relative group"
                    style={{ height: `${height}%` }}
                    title={`${trend.date}: ${trend.searchCount} searches`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {trend.date}: {trend.searchCount} searches
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
