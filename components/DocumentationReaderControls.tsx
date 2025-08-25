'use client';

import { useState } from 'react';
import { ReadingPreferences } from '../lib/documentation-reader';

export interface DocumentationReaderControlsProps {
  preferences: ReadingPreferences;
  onPreferencesChange: (preferences: ReadingPreferences) => void;
  onSearch: (term: string) => void;
  onBookmark: () => void;
  onFullscreen: () => void;
  onPrint: () => void;
  isFullscreen?: boolean;
  hasBookmarks?: boolean;
  className?: string;
}

export default function DocumentationReaderControls({
  preferences,
  onPreferencesChange,
  onSearch,
  onBookmark,
  onFullscreen,
  onPrint,
  isFullscreen = false,
  hasBookmarks = false,
  className = '',
}: DocumentationReaderControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handlePreferenceChange = <K extends keyof ReadingPreferences>(
    key: K,
    value: ReadingPreferences[K]
  ) => {
    onPreferencesChange({
      ...preferences,
      [key]: value,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <div
      className={`
      ${className}
      ${preferences.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      border-b p-4 space-y-4
    `}
    >
      {/* Main Controls Row */}
      <div className="flex items-center justify-between">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in document..."
              className={`
                w-full px-3 py-2 pr-10 rounded border
                ${
                  preferences.theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              `}
            />
            <button
              type="submit"
              className="absolute right-2 top-2 text-gray-500 hover:text-blue-500"
            >
              🔍
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  onSearch('');
                }}
                className="absolute right-8 top-2 text-gray-500 hover:text-red-500"
              >
                ✕
              </button>
            )}
          </div>
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onBookmark}
            className={`
              p-2 rounded-lg transition-colors
              ${
                hasBookmarks
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            title="Bookmark this document"
          >
            ⭐
          </button>

          <button
            onClick={onPrint}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Print document"
          >
            🖨️
          </button>

          <button
            onClick={onFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⤓' : '⤢'}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`
              p-2 rounded-lg transition-colors
              ${
                showSettings
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            title="Reading preferences"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className={`
          ${preferences.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}
          rounded-lg p-4 border
          ${preferences.theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}
        `}
        >
          <h3 className="font-semibold mb-4">Reading Preferences</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium mb-2">Font Size</label>
              <select
                value={preferences.fontSize}
                onChange={(e) => handlePreferenceChange('fontSize', e.target.value as any)}
                className={`
                  w-full px-3 py-2 rounded border
                  ${
                    preferences.theme === 'dark'
                      ? 'bg-gray-600 border-gray-500 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <select
                value={preferences.theme}
                onChange={(e) => handlePreferenceChange('theme', e.target.value as any)}
                className={`
                  w-full px-3 py-2 rounded border
                  ${
                    preferences.theme === 'dark'
                      ? 'bg-gray-600 border-gray-500 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Table of Contents */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.showTableOfContents}
                  onChange={(e) => handlePreferenceChange('showTableOfContents', e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium">Show Table of Contents</span>
              </label>
            </div>

            {/* Syntax Highlighting */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.syntaxHighlighting}
                  onChange={(e) => handlePreferenceChange('syntaxHighlighting', e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium">Syntax Highlighting</span>
              </label>
            </div>

            {/* Show Line Numbers */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.showLineNumbers}
                  onChange={(e) => handlePreferenceChange('showLineNumbers', e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium">Show Line Numbers</span>
              </label>
            </div>

            {/* Auto Bookmark */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.autoBookmark}
                  onChange={(e) => handlePreferenceChange('autoBookmark', e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium">Auto-bookmark Progress</span>
              </label>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePreferenceChange('fontSize', 'small')}
                className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Small Text
              </button>
              <button
                onClick={() => handlePreferenceChange('fontSize', 'large')}
                className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Large Text
              </button>
              <button
                onClick={() =>
                  handlePreferenceChange('theme', preferences.theme === 'light' ? 'dark' : 'light')
                }
                className="px-3 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500"
              >
                Toggle Theme
              </button>
              <button
                onClick={() => {
                  handlePreferenceChange('showTableOfContents', true);
                  handlePreferenceChange('syntaxHighlighting', true);
                  handlePreferenceChange('showLineNumbers', true);
                }}
                className="px-3 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
              >
                Enable All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reading statistics component
export function ReadingStats({
  estimatedTime,
  progress,
  wordsRead,
  className = '',
}: {
  estimatedTime?: number;
  progress?: number;
  wordsRead?: number;
  className?: string;
}) {
  return (
    <div
      className={`${className} flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400`}
    >
      {estimatedTime && <span>📖 {estimatedTime} min read</span>}

      {progress !== undefined && (
        <div className="flex items-center gap-2">
          <span>Progress:</span>
          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <span>{Math.round(progress)}%</span>
        </div>
      )}

      {wordsRead && <span>📝 {wordsRead.toLocaleString()} words</span>}
    </div>
  );
}
