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
  metadata?: DocumentMetadata;
}

export interface DocumentHeading {
  id: string;
  text: string;
  level: number;
  position: number;
}

export interface DocumentMetadata {
  author?: string;
  version?: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime?: number;
  relatedDocuments?: string[];
}

export interface ReadingPreferences {
  fontSize: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark';
  showTableOfContents: boolean;
  syntaxHighlighting: boolean;
  showLineNumbers: boolean;
  autoBookmark: boolean;
}

export interface IDocumentationReaderEngine {
  parseMarkdown(content: string): ParsedContent;
  extractHeadings(content: string): DocumentHeading[];
  highlightSyntax(code: string, language: string): string;
  generateTableOfContents(headings: DocumentHeading[]): TOCItem[];
  calculateReadingTime(content: string): number;
  findRelatedDocuments(document: DocumentationContent): string[];
}

export interface ParsedContent {
  sections: ContentSection[];
  codeBlocks: CodeBlock[];
  headings: DocumentHeading[];
  links: ContentLink[];
}

export interface ContentSection {
  id: string;
  type: 'text' | 'code' | 'image' | 'table' | 'list';
  content: string;
  language?: string;
  metadata?: Record<string, any>;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  startLine?: number;
  endLine?: number;
  filename?: string;
  highlighted?: boolean;
}

export interface ContentLink {
  text: string;
  url: string;
  type: 'internal' | 'external';
  section?: string;
}

export interface TOCItem {
  id: string;
  text: string;
  level: number;
  children?: TOCItem[];
  active?: boolean;
}

// Documentation Reader Engine Implementation
export class DocumentationReaderEngine {
  private static headingRegex = /^(#{1,6})\s+(.+)$/gm;
  private static codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  private static linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  static parseMarkdown(content: string): ParsedContent {
    const sections: ContentSection[] = [];
    const codeBlocks: CodeBlock[] = [];
    const headings = this.extractHeadings(content);
    const links = this.extractLinks(content);

    // Split content into sections based on headings and code blocks
    let currentIndex = 0;
    let sectionId = 0;

    // Process code blocks first
    let match;
    while ((match = this.codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > currentIndex) {
        const textContent = content.slice(currentIndex, match.index).trim();
        if (textContent) {
          sections.push({
            id: `section-${sectionId++}`,
            type: 'text',
            content: textContent,
          });
        }
      }

      // Add code block
      const codeBlock: CodeBlock = {
        id: `code-${codeBlocks.length}`,
        language: match[1] || 'text',
        code: match[2].trim(),
      };

      codeBlocks.push(codeBlock);
      sections.push({
        id: `section-${sectionId++}`,
        type: 'code',
        content: codeBlock.code,
        language: codeBlock.language,
      });

      currentIndex = this.codeBlockRegex.lastIndex;
    }

    // Add remaining text
    if (currentIndex < content.length) {
      const remainingContent = content.slice(currentIndex).trim();
      if (remainingContent) {
        sections.push({
          id: `section-${sectionId++}`,
          type: 'text',
          content: remainingContent,
        });
      }
    }

    return {
      sections,
      codeBlocks,
      headings,
      links,
    };
  }

  static extractHeadings(content: string): DocumentHeading[] {
    const headings: DocumentHeading[] = [];
    let match;

    while ((match = this.headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = this.generateHeadingId(text);

      headings.push({
        id,
        text,
        level,
        position: match.index,
      });
    }

    return headings;
  }

  static extractLinks(content: string): ContentLink[] {
    const links: ContentLink[] = [];
    let match;

    while ((match = this.linkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      const type = url.startsWith('http') ? 'external' : 'internal';

      links.push({
        text,
        url,
        type,
        section: type === 'internal' ? url.replace('#', '') : undefined,
      });
    }

    return links;
  }

  static generateTableOfContents(headings: DocumentHeading[]): TOCItem[] {
    const toc: TOCItem[] = [];
    const stack: TOCItem[] = [];

    for (const heading of headings) {
      const tocItem: TOCItem = {
        id: heading.id,
        text: heading.text,
        level: heading.level,
        children: [],
      };

      // Find the appropriate parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        toc.push(tocItem);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(tocItem);
      }

      stack.push(tocItem);
    }

    return toc;
  }

  static calculateReadingTime(content: string): number {
    // Average reading speed: 200 words per minute
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  static generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  static highlightSearchTerms(content: string, searchTerm: string): string {
    if (!searchTerm.trim()) return content;

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return content.replace(
      regex,
      '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>'
    );
  }

  static findRelatedDocuments(
    document: DocumentationContent,
    allDocuments: DocumentationContent[]
  ): DocumentationContent[] {
    const related: Array<{ doc: DocumentationContent; score: number }> = [];

    for (const doc of allDocuments) {
      if (doc.id === document.id) continue;

      let score = 0;

      // Tag similarity
      if (document.tags && doc.tags) {
        const commonTags = document.tags.filter((tag) => doc.tags?.includes(tag));
        score += commonTags.length * 10;
      }

      // Language similarity
      if (document.language && doc.language && document.language === doc.language) {
        score += 5;
      }

      // Type similarity
      if (document.type === doc.type) {
        score += 3;
      }

      // Content similarity (basic keyword matching)
      const docKeywords = this.extractKeywords(document.content);
      const otherKeywords = this.extractKeywords(doc.content);
      const commonKeywords = docKeywords.filter((keyword) => otherKeywords.includes(keyword));
      score += commonKeywords.length;

      if (score > 0) {
        related.push({ doc, score });
      }
    }

    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.doc);
  }

  private static extractKeywords(content: string): string[] {
    // Extract meaningful words (3+ characters, not common stop words)
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'was',
      'one',
      'our',
      'has',
      'had',
      'this',
      'that',
      'with',
      'have',
      'from',
      'they',
      'she',
      'her',
      'been',
      'than',
      'its',
    ]);

    return (
      content
        .toLowerCase()
        .match(/\b\w{3,}\b/g)
        ?.filter((word) => !stopWords.has(word))
        ?.slice(0, 20) || []
    );
  }
}

// Reading session tracking
export interface ReadingSession {
  documentId: string;
  startTime: Date;
  endTime?: Date;
  progress: number;
  bookmarks: string[];
  notes: ReadingNote[];
}

export interface ReadingNote {
  id: string;
  text: string;
  position: number;
  timestamp: Date;
  type: 'highlight' | 'note' | 'question';
}

export class ReadingSessionManager {
  private sessions = new Map<string, ReadingSession>();

  startSession(documentId: string): ReadingSession {
    const session: ReadingSession = {
      documentId,
      startTime: new Date(),
      progress: 0,
      bookmarks: [],
      notes: [],
    };

    this.sessions.set(documentId, session);
    return session;
  }

  updateProgress(documentId: string, progress: number): void {
    const session = this.sessions.get(documentId);
    if (session) {
      session.progress = Math.max(session.progress, progress);
    }
  }

  addBookmark(documentId: string, headingId: string): void {
    const session = this.sessions.get(documentId);
    if (session && !session.bookmarks.includes(headingId)) {
      session.bookmarks.push(headingId);
    }
  }

  addNote(documentId: string, note: Omit<ReadingNote, 'id' | 'timestamp'>): void {
    const session = this.sessions.get(documentId);
    if (session) {
      const fullNote: ReadingNote = {
        ...note,
        id: `note-${Date.now()}`,
        timestamp: new Date(),
      };
      session.notes.push(fullNote);
    }
  }

  endSession(documentId: string): ReadingSession | undefined {
    const session = this.sessions.get(documentId);
    if (session) {
      session.endTime = new Date();
      return session;
    }
    return undefined;
  }

  getSession(documentId: string): ReadingSession | undefined {
    return this.sessions.get(documentId);
  }
}

// Default preferences
export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  fontSize: 'medium',
  theme: 'light',
  showTableOfContents: true,
  syntaxHighlighting: true,
  showLineNumbers: true,
  autoBookmark: false,
};
