'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DocumentComparisonResult,
  DocumentVersion,
  SideBySideView,
  DocumentComparisonEngine,
  DiffVisualizationOptions,
  AlignedLine,
  DocumentChange,
} from '../lib/document-comparison';

export interface DocumentComparisonProps {
  comparison?: DocumentComparisonResult;
  onComparisonGenerate?: (docA: DocumentVersion, docB: DocumentVersion) => void;
  className?: string;
  theme?: 'light' | 'dark';
  initialOptions?: Partial<DiffVisualizationOptions>;
}

export default function DocumentComparison({
  comparison,
  onComparisonGenerate,
  className = '',
  theme = 'light',
  initialOptions = {},
}: DocumentComparisonProps) {
  const [documentA, setDocumentA] = useState<DocumentVersion | null>(null);
  const [documentB, setDocumentB] = useState<DocumentVersion | null>(null);
  const [currentComparison, setCurrentComparison] = useState<DocumentComparisonResult | undefined>(
    comparison
  );
  const [sideBySideView, setSideBySideView] = useState<SideBySideView | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified' | 'statistics'>(
    'side-by-side'
  );
  const [options, setOptions] = useState<DiffVisualizationOptions>({
    showLineNumbers: true,
    highlightSyntax: true,
    showInlineChanges: true,
    contextLines: 3,
    theme,
    compactMode: false,
    showStatistics: true,
    showMetadata: true,
    ...initialOptions,
  });
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const themeClasses = {
    light: {
      background: 'bg-white',
      border: 'border-gray-200',
      text: 'text-gray-900',
      muted: 'text-gray-500',
      panel: 'bg-gray-50',
      addition: 'bg-green-50 border-l-4 border-l-green-500',
      deletion: 'bg-red-50 border-l-4 border-l-red-500',
      modification: 'bg-yellow-50 border-l-4 border-l-yellow-500',
      unchanged: 'bg-white',
      lineNumber: 'bg-gray-100 text-gray-600',
      inlineAddition: 'bg-green-200',
      inlineDeletion: 'bg-red-200',
      inlineModification: 'bg-yellow-200',
    },
    dark: {
      background: 'bg-gray-800',
      border: 'border-gray-600',
      text: 'text-gray-100',
      muted: 'text-gray-400',
      panel: 'bg-gray-700',
      addition: 'bg-green-900/30 border-l-4 border-l-green-400',
      deletion: 'bg-red-900/30 border-l-4 border-l-red-400',
      modification: 'bg-yellow-900/30 border-l-4 border-l-yellow-400',
      unchanged: 'bg-gray-800',
      lineNumber: 'bg-gray-700 text-gray-300',
      inlineAddition: 'bg-green-800',
      inlineDeletion: 'bg-red-800',
      inlineModification: 'bg-yellow-800',
    },
  };

  const currentTheme = themeClasses[theme];

  // Update options when theme changes
  useEffect(() => {
    setOptions((prev) => ({ ...prev, theme }));
  }, [theme]);

  // Generate comparison when documents change
  useEffect(() => {
    if (documentA && documentB) {
      generateComparison();
    }
  }, [documentA, documentB]);

  // Generate side-by-side view when comparison changes
  useEffect(() => {
    if (currentComparison) {
      const view = DocumentComparisonEngine.generateSideBySideView(currentComparison);
      setSideBySideView(view);
    }
  }, [currentComparison]);

  const generateComparison = async () => {
    if (!documentA || !documentB) return;

    try {
      const result = await DocumentComparisonEngine.compareDocuments(documentA, documentB, options);
      setCurrentComparison(result);
      onComparisonGenerate?.(documentA, documentB);
    } catch (error) {
      console.error('Error generating comparison:', error);
    }
  };

  const handleDocumentUpload = (docType: 'A' | 'B', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const document = DocumentComparisonEngine.createDocumentVersion(file.name, content, {
        type: file.name.endsWith('.md')
          ? 'markdown'
          : file.name.endsWith('.json')
            ? 'json'
            : file.name.endsWith('.yml') || file.name.endsWith('.yaml')
              ? 'yaml'
              : 'text',
        lastModified: new Date(file.lastModified),
        language: getLanguageFromFilename(file.name),
      });

      if (docType === 'A') {
        setDocumentA(document);
      } else {
        setDocumentB(document);
      }
    };
    reader.readAsText(file);
  };

  const handleTextInput = (docType: 'A' | 'B', title: string, content: string) => {
    const document = DocumentComparisonEngine.createDocumentVersion(title, content);

    if (docType === 'A') {
      setDocumentA(document);
    } else {
      setDocumentB(document);
    }
  };

  const handleChangeSelect = (changeId: string) => {
    setSelectedChange(changeId === selectedChange ? null : changeId);

    // Scroll to change if it exists
    const changeElement = document.getElementById(`change-${changeId}`);
    if (changeElement) {
      changeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getFilteredChanges = (): DocumentChange[] => {
    if (!currentComparison) return [];

    return currentComparison.changes.filter((change) => {
      if (filterSeverity !== 'all' && change.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && change.category !== filterCategory) return false;
      return true;
    });
  };

  const renderLineContent = (line: AlignedLine, side: 'left' | 'right') => {
    const content = side === 'left' ? line.leftContent : line.rightContent;
    if (!content && content !== '') return null;

    // Apply inline changes if they exist
    if (line.inlineChanges && line.inlineChanges.length > 0 && line.changeType === 'modification') {
      const parts = [];
      let lastIndex = 0;

      line.inlineChanges.forEach((change, index) => {
        // Add unchanged text before this change
        if (change.startIndex > lastIndex) {
          parts.push(
            <span key={`unchanged-${index}`}>{content.slice(lastIndex, change.startIndex)}</span>
          );
        }

        // Add the change
        const changeClass =
          change.type === 'addition'
            ? currentTheme.inlineAddition
            : change.type === 'deletion'
              ? currentTheme.inlineDeletion
              : currentTheme.inlineModification;

        parts.push(
          <span key={`change-${index}`} className={`${changeClass} px-1 rounded`}>
            {change.text || change.originalText}
          </span>
        );

        lastIndex = change.endIndex;
      });

      // Add remaining unchanged text
      if (lastIndex < content.length) {
        parts.push(<span key="remaining">{content.slice(lastIndex)}</span>);
      }

      return <span className="font-mono text-sm">{parts}</span>;
    }

    return <span className="font-mono text-sm">{content}</span>;
  };

  const renderSideBySideView = () => {
    if (!sideBySideView) return null;

    const filteredLines = sideBySideView.alignedLines.filter((line) => {
      if (!line.changeId) return true; // Show unchanged lines
      const change = currentComparison?.changes.find((c) => c.id === line.changeId);
      if (!change) return true;

      if (filterSeverity !== 'all' && change.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && change.category !== filterCategory) return false;
      return true;
    });

    return (
      <div className="flex h-full">
        {/* Left Document */}
        <div className="flex-1 border-r border-gray-300 dark:border-gray-600">
          <div className={`p-3 border-b ${currentTheme.border} ${currentTheme.panel}`}>
            <h3 className="font-semibold">{sideBySideView.leftDocument.title}</h3>
            <p className={`text-sm ${currentTheme.muted}`}>
              {sideBySideView.leftDocument.lineCount} lines •{sideBySideView.leftDocument.wordCount}{' '}
              words
            </p>
          </div>
          <div ref={leftPanelRef} className="overflow-auto h-full">
            {filteredLines.map((line, index) => (
              <div
                key={`left-${index}`}
                id={line.changeId ? `change-${line.changeId}` : undefined}
                className={`
                  flex border-b border-gray-100 dark:border-gray-700 min-h-[24px]
                  ${line.changeType === 'addition' ? 'opacity-30' : ''}
                  ${line.changeType === 'deletion' ? currentTheme.deletion : ''}
                  ${line.changeType === 'modification' ? currentTheme.modification : ''}
                  ${line.changeType === 'none' ? currentTheme.unchanged : ''}
                  ${selectedChange === line.changeId ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => line.changeId && handleChangeSelect(line.changeId)}
              >
                {options.showLineNumbers && (
                  <div
                    className={`
                    w-12 flex-shrink-0 px-2 py-1 text-xs text-center
                    ${currentTheme.lineNumber} border-r border-gray-200 dark:border-gray-600
                  `}
                  >
                    {line.leftLineNumber || ''}
                  </div>
                )}
                <div className="flex-1 px-3 py-1">{renderLineContent(line, 'left')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Document */}
        <div className="flex-1">
          <div className={`p-3 border-b ${currentTheme.border} ${currentTheme.panel}`}>
            <h3 className="font-semibold">{sideBySideView.rightDocument.title}</h3>
            <p className={`text-sm ${currentTheme.muted}`}>
              {sideBySideView.rightDocument.lineCount} lines •
              {sideBySideView.rightDocument.wordCount} words
            </p>
          </div>
          <div ref={rightPanelRef} className="overflow-auto h-full">
            {filteredLines.map((line, index) => (
              <div
                key={`right-${index}`}
                className={`
                  flex border-b border-gray-100 dark:border-gray-700 min-h-[24px]
                  ${line.changeType === 'deletion' ? 'opacity-30' : ''}
                  ${line.changeType === 'addition' ? currentTheme.addition : ''}
                  ${line.changeType === 'modification' ? currentTheme.modification : ''}
                  ${line.changeType === 'none' ? currentTheme.unchanged : ''}
                  ${selectedChange === line.changeId ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => line.changeId && handleChangeSelect(line.changeId)}
              >
                {options.showLineNumbers && (
                  <div
                    className={`
                    w-12 flex-shrink-0 px-2 py-1 text-xs text-center
                    ${currentTheme.lineNumber} border-r border-gray-200 dark:border-gray-600
                  `}
                  >
                    {line.rightLineNumber || ''}
                  </div>
                )}
                <div className="flex-1 px-3 py-1">{renderLineContent(line, 'right')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStatistics = () => {
    if (!currentComparison) return null;

    const stats = currentComparison.statistics;

    return (
      <div className="space-y-6 p-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalChanges}
            </div>
            <div className={`text-sm ${currentTheme.muted}`}>Total Changes</div>
          </div>

          <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.additions}
            </div>
            <div className={`text-sm ${currentTheme.muted}`}>Additions</div>
          </div>

          <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.deletions}
            </div>
            <div className={`text-sm ${currentTheme.muted}`}>Deletions</div>
          </div>

          <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.modifications}
            </div>
            <div className={`text-sm ${currentTheme.muted}`}>Modifications</div>
          </div>
        </div>

        {/* Similarity Score */}
        <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
          <h3 className="font-semibold mb-2">Similarity Score</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${stats.similarityPercentage}%` }}
              />
            </div>
            <span className="font-bold">{stats.similarityPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Change Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3">Changes by Category</h3>
            <div className="space-y-2">
              {Object.entries(stats.changesByCategory).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="capitalize">{category}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Changes by Severity</h3>
            <div className="space-y-2">
              {Object.entries(stats.changeBySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <span
                    className={`
                    capitalize px-2 py-1 rounded text-xs
                    ${severity === 'major' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}
                    ${severity === 'moderate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                    ${severity === 'minor' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                  `}
                  >
                    {severity}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Statistics */}
        <div className={`p-4 rounded-lg ${currentTheme.panel}`}>
          <h3 className="font-semibold mb-3">Detailed Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              Lines Added: <span className="font-medium">{stats.linesAdded}</span>
            </div>
            <div>
              Lines Deleted: <span className="font-medium">{stats.linesDeleted}</span>
            </div>
            <div>
              Words Added: <span className="font-medium">{stats.wordsAdded}</span>
            </div>
            <div>
              Words Deleted: <span className="font-medium">{stats.wordsDeleted}</span>
            </div>
            <div>
              Characters Added: <span className="font-medium">{stats.charactersAdded}</span>
            </div>
            <div>
              Characters Deleted: <span className="font-medium">{stats.charactersDeleted}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`${className} ${currentTheme.background} ${currentTheme.text} h-full flex flex-col`}
    >
      {/* Header */}
      <div className={`p-4 border-b ${currentTheme.border} flex-shrink-0`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Document Comparison</h2>

          <div className="flex items-center gap-4">
            {/* View Mode Selector */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`
                  px-3 py-1 text-sm rounded-l-lg
                  ${
                    viewMode === 'side-by-side'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('statistics')}
                className={`
                  px-3 py-1 text-sm rounded-r-lg
                  ${
                    viewMode === 'statistics'
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                Statistics
              </button>
            </div>

            {/* Export Button */}
            {currentComparison && (
              <button
                onClick={() => {
                  const jsonData = DocumentComparisonEngine.exportComparison(
                    currentComparison,
                    'json'
                  );
                  const blob = new Blob([jsonData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'comparison.json';
                  a.click();
                }}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {currentComparison && viewMode === 'side-by-side' && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <label>Severity:</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className={`
                  px-2 py-1 rounded border
                  ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                `}
              >
                <option value="all">All</option>
                <option value="major">Major</option>
                <option value="moderate">Moderate</option>
                <option value="minor">Minor</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label>Category:</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`
                  px-2 py-1 rounded border
                  ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}
                `}
              >
                <option value="all">All</option>
                <option value="structure">Structure</option>
                <option value="content">Content</option>
                <option value="format">Format</option>
                <option value="style">Style</option>
              </select>
            </div>

            <div className="ml-auto text-xs text-gray-500">
              {getFilteredChanges().length} of {currentComparison.changes.length} changes shown
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!currentComparison ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-8">
              <h3 className="text-lg font-semibold mb-4">Upload Documents to Compare</h3>
              <p className={`${currentTheme.muted} mb-6`}>
                Upload two documents to see a detailed comparison with changes, statistics, and
                visualizations.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Document A</label>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.yml,.yaml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentUpload('A', file);
                    }}
                    className="block w-full text-sm text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Document B</label>
                  <input
                    type="file"
                    accept=".txt,.md,.json,.yml,.yaml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentUpload('B', file);
                    }}
                    className="block w-full text-sm text-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'side-by-side' && renderSideBySideView()}
            {viewMode === 'statistics' && renderStatistics()}
          </>
        )}
      </div>
    </div>
  );
}

function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
  };

  return languageMap[extension || ''] || 'text';
}
