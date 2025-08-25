'use client';

import { useState, useRef, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export interface DocumentationContent {
  id: string;
  title: string;
  content: string;
  type: 'markdown' | 'code' | 'text';
  language?: string;
  source: string;
  lastUpdated?: string;
  tags?: string[];
  headings?: DocumentHeading[];
}

export interface DocumentHeading {
  id: string;
  text: string;
  level: number;
  position: number;
}

export interface DocumentationReaderProps {
  document: DocumentationContent;
  onNavigate?: (headingId: string) => void;
  onBookmark?: (document: DocumentationContent) => void;
  className?: string;
  showTableOfContents?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
}

interface CodeBlock {
  language: string;
  code: string;
  startLine?: number;
}

export default function DocumentationReader({
  document: doc,
  onNavigate,
  onBookmark,
  className = '',
  showTableOfContents = true,
  fontSize = 'medium',
  theme = 'light',
}: DocumentationReaderProps) {
  const [selectedHeading, setSelectedHeading] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedText, setHighlightedText] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [tocCollapsed, setTocCollapsed] = useState(false);

  const fontSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  const themeClasses = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
  };

  // Parse content for code blocks and markdown
  const parseContent = (content: string) => {
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'text',
      });

      lastIndex = codeBlockRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return parts;
  };

  // Generate table of contents from headings
  const generateTOC = () => {
    if (!doc.headings || doc.headings.length === 0) {
      // Auto-generate headings from markdown content
      if (doc.type === 'markdown' && doc.content) {
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const headings: DocumentHeading[] = [];
        let match;
        let position = 0;

        while ((match = headingRegex.exec(doc.content)) !== null) {
          const level = match[1].length;
          const text = match[2].trim();
          const id = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');

          headings.push({
            id,
            text,
            level,
            position: position++,
          });
        }

        return headings;
      }
      return [];
    }
    return doc.headings;
  };

  // Handle heading navigation
  const handleHeadingClick = (headingId: string) => {
    setSelectedHeading(headingId);
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onNavigate?.(headingId);
  };

  // Search functionality
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim()) {
      const highlights = doc.content
        .toLowerCase()
        .split(term.toLowerCase())
        .map((_, index) => `highlight-${index}`)
        .slice(0, -1);
      setHighlightedText(highlights);
    } else {
      setHighlightedText([]);
    }
  };

  // Highlight search terms in text
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;

    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts
      .map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase()
          ? `<mark class="bg-yellow-200 px-1 rounded">${part}</mark>`
          : part
      )
      .join('');
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Copy code to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const tableOfContents = generateTOC();
  const contentParts = parseContent(doc.content);

  return (
    <div
      className={`
      ${className}
      ${themeClasses[theme]}
      ${fontSizeClasses[fontSize]}
      ${isFullscreen ? 'fixed inset-0 z-50' : 'relative'}
      flex flex-col lg:flex-row h-full
    `}
    >
      {/* Table of Contents Sidebar */}
      {showTableOfContents && tableOfContents.length > 0 && (
        <div
          className={`
          ${tocCollapsed ? 'w-12' : 'w-64'}
          ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}
          border-r flex-shrink-0 overflow-hidden transition-all duration-300
        `}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${tocCollapsed ? 'hidden' : 'block'}`}>Contents</h3>
              <button
                onClick={() => setTocCollapsed(!tocCollapsed)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title={tocCollapsed ? 'Expand TOC' : 'Collapse TOC'}
              >
                {tocCollapsed ? '→' : '←'}
              </button>
            </div>
          </div>

          {!tocCollapsed && (
            <nav className="p-4 space-y-2 overflow-y-auto max-h-full">
              {tableOfContents.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => handleHeadingClick(heading.id)}
                  className={`
                    block w-full text-left py-1 px-2 rounded text-sm
                    ${
                      selectedHeading === heading.id
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                  style={{ paddingLeft: `${heading.level * 8 + 8}px` }}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with controls */}
        <header
          className={`
          ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          border-b p-4 flex-shrink-0
        `}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 mr-4">
              <h1 className="text-xl font-bold mb-1">{doc.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>Source: {doc.source}</span>
                {doc.lastUpdated && (
                  <span>Updated: {new Date(doc.lastUpdated).toLocaleDateString()}</span>
                )}
                {doc.type === 'code' && doc.language && (
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                    {doc.language}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onBookmark && (
                <button
                  onClick={() => onBookmark(doc)}
                  className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Bookmark document"
                >
                  ⭐
                </button>
              )}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? '⤓' : '⤢'}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search in document..."
              className={`
                w-full px-3 py-2 rounded border
                ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-gray-100'
                    : 'bg-white border-gray-300 text-gray-900'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
            />
            {searchTerm && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto p-6" ref={contentRef}>
          <div className="max-w-4xl mx-auto">
            {/* Tags */}
            {doc.tags && doc.tags.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`
                      px-2 py-1 rounded-full text-xs
                      ${
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                      }
                    `}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Rendered Content */}
            <div className="prose prose-lg max-w-none dark:prose-invert">
              {contentParts.map((part, index) => {
                if (part.type === 'code') {
                  return (
                    <div key={index} className="relative my-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {part.language}
                        </span>
                        <button
                          onClick={() => copyToClipboard(part.content)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="rounded-lg overflow-hidden">
                        <SyntaxHighlighter
                          language={part.language}
                          style={theme === 'dark' ? vscDarkPlus : undefined}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: 'inherit',
                          }}
                          showLineNumbers
                          wrapLines
                        >
                          {part.content}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  );
                } else {
                  // Render markdown/text content with search highlighting
                  const highlightedContent = highlightText(part.content, searchTerm);
                  return (
                    <div
                      key={index}
                      className="mb-4 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlightedContent }}
                    />
                  );
                }
              })}
            </div>

            {/* Reading Progress Indicator */}
            <div
              className={`
              fixed bottom-4 right-4 w-12 h-12 rounded-full border-4
              ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}
              flex items-center justify-center text-xs font-bold
              ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}
            `}
            >
              {/* This would be calculated based on scroll position */}
              75%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility component for standalone usage
export function DocumentationReaderContainer({
  documentId,
  ...props
}: Omit<DocumentationReaderProps, 'document'> & { documentId: string }) {
  const [document, setDocument] = useState<DocumentationContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This would typically fetch from your API
    const fetchDocument = async () => {
      try {
        // Placeholder for actual API call
        const mockDocument: DocumentationContent = {
          id: documentId,
          title: 'Loading...',
          content: 'Loading document content...',
          type: 'text',
          source: 'API',
          headings: [],
        };
        setDocument(mockDocument);
      } catch (error) {
        console.error('Failed to fetch document:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">Document not found</div>
    );
  }

  return <DocumentationReader document={document} {...props} />;
}
