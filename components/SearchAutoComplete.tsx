'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SearchSuggestion,
  SearchContext,
  RealTimeSuggestionManager,
  SEARCH_COMMANDS,
} from '../lib/search-suggestions';

export interface SearchAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchHistory?: Array<{ query: string; timestamp: Date; resultsCount: number }>;
  popularTerms?: Array<{ term: string; count: number }>;
  activeFilters?: Record<string, any>;
  theme?: 'light' | 'dark';
  showCommands?: boolean;
  enableRealTime?: boolean;
}

export default function SearchAutoComplete({
  value,
  onChange,
  onSubmit,
  onSuggestionSelect,
  placeholder = 'Search documentation...',
  className = '',
  disabled = false,
  searchHistory = [],
  popularTerms = [],
  activeFilters = {},
  theme = 'light',
  showCommands = true,
  enableRealTime = true,
}: SearchAutoCompleteProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  const suggestionManager = useRef(
    new RealTimeSuggestionManager({
      maxSuggestions: 8,
      debounceMs: 150,
      enableFuzzyMatch: true,
      contextualBoost: true,
    })
  );

  const themeClasses = {
    light: {
      input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500',
      suggestions: 'bg-white border-gray-200 shadow-lg',
      suggestion: 'hover:bg-gray-50',
      selectedSuggestion: 'bg-blue-50 text-blue-900',
      commandHighlight: 'text-blue-600',
      descriptionText: 'text-gray-500',
    },
    dark: {
      input: 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-400',
      suggestions: 'bg-gray-800 border-gray-600 shadow-xl',
      suggestion: 'hover:bg-gray-700',
      selectedSuggestion: 'bg-blue-900 text-blue-100',
      commandHighlight: 'text-blue-400',
      descriptionText: 'text-gray-400',
    },
  };

  const currentTheme = themeClasses[theme];

  // Generate suggestions based on current context
  const generateSuggestions = useCallback(async () => {
    if (!enableRealTime || value.length === 0) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const context: SearchContext = {
      currentQuery: value,
      cursorPosition,
      recentQueries: searchHistory.slice(0, 5).map((h) => h.query),
      activeFilters,
      searchHistory,
      popularTerms,
    };

    setLoading(true);

    try {
      const newSuggestions = await suggestionManager.current.getSuggestions(context);
      setSuggestions(newSuggestions);
      setSelectedIndex(-1);
    } catch (error) {
      if (error instanceof Error && error.message !== 'Request aborted') {
        console.error('Error generating suggestions:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [value, cursorPosition, searchHistory, popularTerms, activeFilters, enableRealTime]);

  // Update suggestions when value changes
  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart || 0;

    onChange(newValue);
    setCursorPosition(newCursorPosition);
    setShowSuggestions(true);
  };

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          handleSubmit();
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;

      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: SearchSuggestion) => {
    const newValue =
      suggestion.type === 'completion' ? suggestion.text : handleCommandInsertion(suggestion.text);

    onChange(newValue);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    onSuggestionSelect?.(suggestion);
  };

  // Handle command insertion at cursor position
  const handleCommandInsertion = (suggestionText: string): string => {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);

    // If suggestion is a command and we're completing it
    const commandMatch = beforeCursor.match(/(\w+):(\w*)$/);
    if (commandMatch && suggestionText.includes(':')) {
      const [fullMatch] = commandMatch;
      const beforeCommand = beforeCursor.slice(0, -fullMatch.length);
      return beforeCommand + suggestionText + afterCursor;
    }

    // If replacing the entire query
    if (suggestionText.includes(':') || value.trim() === '') {
      return suggestionText;
    }

    // Otherwise, replace the current word
    const words = beforeCursor.split(' ');
    const currentWord = words.pop() || '';
    const beforeWord = words.join(' ');

    return (beforeWord ? beforeWord + ' ' : '') + suggestionText + afterCursor;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setShowSuggestions(false);
    }
  };

  // Handle input focus
  const handleFocus = () => {
    if (value.length > 0 || suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle input blur (with delay to allow for suggestion clicks)
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  // Handle cursor position updates
  const handleCursorMove = () => {
    const newPosition = inputRef.current?.selectionStart || 0;
    setCursorPosition(newPosition);
  };

  // Render suggestion icon
  const renderSuggestionIcon = (suggestion: SearchSuggestion) => {
    if (suggestion.icon) {
      return <span className="text-sm">{suggestion.icon}</span>;
    }

    switch (suggestion.type) {
      case 'command':
        return <span className="text-sm">⚡</span>;
      case 'completion':
        return <span className="text-sm">✨</span>;
      case 'query':
        switch (suggestion.source) {
          case 'history':
            return <span className="text-sm">🕒</span>;
          case 'popular':
            return <span className="text-sm">🔥</span>;
          case 'semantic':
            return <span className="text-sm">🧠</span>;
          default:
            return <span className="text-sm">🔍</span>;
        }
      default:
        return <span className="text-sm">💡</span>;
    }
  };

  // Highlight matching text in suggestions
  const highlightMatchingText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseUp={handleCursorMove}
          onKeyUp={handleCursorMove}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-3 pr-12 rounded-lg border-2 transition-colors
            ${currentTheme.input}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20
          `}
        />

        {/* Search Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          ) : (
            <span className="text-gray-400 text-lg">🔍</span>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionListRef}
          className={`
            absolute z-50 w-full mt-1 rounded-lg border max-h-80 overflow-y-auto
            ${currentTheme.suggestions}
          `}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={() => selectSuggestion(suggestion)}
              className={`
                px-4 py-3 cursor-pointer border-b last:border-b-0
                ${
                  index === selectedIndex
                    ? currentTheme.selectedSuggestion
                    : currentTheme.suggestion
                }
                ${suggestion.type === 'command' ? 'border-l-4 border-l-blue-500' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{renderSuggestionIcon(suggestion)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div
                      className={`
                      font-medium truncate
                      ${suggestion.type === 'command' ? currentTheme.commandHighlight : ''}
                    `}
                    >
                      {highlightMatchingText(suggestion.text, value)}
                    </div>

                    {/* Score/Metadata */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                      {suggestion.metadata?.resultCount && (
                        <span>{suggestion.metadata.resultCount} results</span>
                      )}
                      {suggestion.metadata?.frequency && (
                        <span>{suggestion.metadata.frequency}x</span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {suggestion.description && (
                    <div className={`text-sm mt-1 truncate ${currentTheme.descriptionText}`}>
                      {suggestion.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Command Help Panel */}
      {showCommands && showSuggestions && value.includes(':') && (
        <div
          className={`
          absolute z-40 right-0 top-full mt-1 w-80 p-4 rounded-lg border
          ${currentTheme.suggestions}
        `}
        >
          <h4 className="font-semibold mb-2 text-sm">Search Commands</h4>
          <div className="space-y-2">
            {SEARCH_COMMANDS.slice(0, 4).map((cmd) => (
              <div key={cmd.command} className="text-xs">
                <span className={`font-mono ${currentTheme.commandHighlight}`}>{cmd.command}</span>
                <span className={currentTheme.descriptionText}> - {cmd.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Utility component for search shortcuts display
export function SearchShortcuts({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  const shortcuts = [
    { key: '↑↓', description: 'Navigate suggestions' },
    { key: 'Enter', description: 'Select suggestion or search' },
    { key: 'Tab', description: 'Accept suggestion' },
    { key: 'Esc', description: 'Close suggestions' },
  ];

  return (
    <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
      <div className="flex flex-wrap gap-4">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.key} className="flex items-center gap-1">
            <kbd
              className={`
              px-1.5 py-0.5 rounded text-xs font-mono
              ${
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 border border-gray-600'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }
            `}
            >
              {shortcut.key}
            </kbd>
            <span>{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Preview component showing search context
export function SearchContextPreview({
  activeFilters,
  searchHistory,
  theme = 'light',
}: {
  activeFilters: Record<string, any>;
  searchHistory: Array<{ query: string; timestamp: Date; resultsCount: number }>;
  theme?: 'light' | 'dark';
}) {
  const hasFilters = Object.keys(activeFilters).length > 0;
  const recentQueries = searchHistory.slice(0, 3);

  if (!hasFilters && recentQueries.length === 0) return null;

  return (
    <div
      className={`
      mt-2 p-3 rounded-lg text-sm
      ${
        theme === 'dark'
          ? 'bg-gray-800 border border-gray-700 text-gray-300'
          : 'bg-gray-50 border border-gray-200 text-gray-600'
      }
    `}
    >
      {hasFilters && (
        <div className="mb-2">
          <span className="font-medium">Active Filters: </span>
          {Object.entries(activeFilters).map(([key, value]) => (
            <span
              key={key}
              className={`
                inline-block px-2 py-1 rounded text-xs mr-1 mb-1
                ${theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}
              `}
            >
              {key}: {Array.isArray(value) ? value.join(', ') : value}
            </span>
          ))}
        </div>
      )}

      {recentQueries.length > 0 && (
        <div>
          <span className="font-medium">Recent: </span>
          {recentQueries.map((item, index) => (
            <span key={index} className="mr-3">
              "{item.query}" ({item.resultsCount})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
