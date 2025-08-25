import { PrismaClient } from './generated/prisma';

interface ClassificationResult {
  contentType: string;
  confidence: number;
  language?: string;
  wordCount: number;
  codeExamples: Array<{
    language: string;
    codeContent: string;
    isValid: boolean;
    lineStart?: number;
    lineEnd?: number;
    context?: string;
  }>;
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
  };
}

export class ContentClassifier {
  private static readonly CONTENT_TYPE_PATTERNS = {
    api: {
      keywords: [
        'api reference',
        'endpoint',
        'rest api',
        'graphql',
        'method',
        'parameter',
        'response',
        'request',
        'authentication',
        'authorization',
        'rate limit',
        'sdk',
        'client library',
        'curl',
        'postman',
      ],
      urlPatterns: [
        '/api/',
        '/reference/',
        '/rest/',
        '/graphql/',
        'api-reference',
        'api-docs',
        'swagger',
        'openapi',
      ],
      titlePatterns: ['api', 'reference', 'endpoint', 'rest', 'graphql'],
    },
    tutorial: {
      keywords: [
        'tutorial',
        'guide',
        'walkthrough',
        'step by step',
        'getting started',
        'quickstart',
        'how to',
        'learn',
        'introduction',
        'beginner',
        'basics',
        'example',
        'lesson',
        'course',
        'training',
      ],
      urlPatterns: [
        '/tutorial/',
        '/guide/',
        '/learn/',
        '/getting-started/',
        '/quickstart/',
        '/intro/',
        '/basics/',
        '/examples/',
        'tutorial',
        'guide',
        'learn',
      ],
      titlePatterns: [
        'tutorial',
        'guide',
        'getting started',
        'quickstart',
        'how to',
        'walkthrough',
        'introduction',
      ],
    },
    example: {
      keywords: [
        'example',
        'sample',
        'demo',
        'showcase',
        'template',
        'boilerplate',
        'starter',
        'code example',
        'snippet',
        'playground',
        'sandbox',
        'live demo',
        'codepen',
      ],
      urlPatterns: [
        '/example/',
        '/examples/',
        '/demo/',
        '/sample/',
        '/playground/',
        '/sandbox/',
        '/showcase/',
        'example',
        'demo',
        'sample',
      ],
      titlePatterns: ['example', 'demo', 'sample', 'showcase', 'template', 'playground', 'starter'],
    },
    changelog: {
      keywords: [
        'changelog',
        'release notes',
        'version',
        'update',
        "what's new",
        'breaking changes',
        'migration',
        'release',
        'version history',
        'updates',
      ],
      urlPatterns: [
        '/changelog',
        '/releases',
        '/release-notes',
        '/version',
        '/updates',
        '/migration',
        'changelog',
        'releases',
        'whats-new',
      ],
      titlePatterns: [
        'changelog',
        'release',
        'version',
        'update',
        "what's new",
        'breaking changes',
      ],
    },
    guide: {
      keywords: [
        'documentation',
        'docs',
        'manual',
        'handbook',
        'specification',
        'spec',
        'overview',
        'concepts',
        'architecture',
        'design',
        'best practices',
        'configuration',
        'setup',
        'installation',
      ],
      urlPatterns: [
        '/docs/',
        '/documentation/',
        '/manual/',
        '/spec/',
        '/specification/',
        '/handbook/',
        'docs',
        'documentation',
        'guide',
      ],
      titlePatterns: [
        'documentation',
        'guide',
        'manual',
        'handbook',
        'overview',
        'concepts',
        'specification',
      ],
    },
  };

  private static readonly PROGRAMMING_LANGUAGES = {
    javascript: ['javascript', 'js', 'node', 'npm', 'yarn'],
    typescript: ['typescript', 'ts', 'tsc'],
    python: ['python', 'py', 'pip', 'django', 'flask'],
    java: ['java', 'spring', 'maven', 'gradle'],
    go: ['golang', 'go'],
    rust: ['rust', 'cargo', 'rustc'],
    php: ['php', 'composer', 'laravel'],
    ruby: ['ruby', 'rails', 'gem'],
    csharp: ['c#', 'csharp', 'dotnet', '.net'],
    cpp: ['c++', 'cpp', 'cmake'],
    swift: ['swift', 'ios', 'xcode'],
    kotlin: ['kotlin', 'android'],
  };

  static async classifyContent(
    url: string,
    content: string,
    title?: string
  ): Promise<ClassificationResult> {
    const lowerContent = content.toLowerCase();
    const lowerUrl = url.toLowerCase();
    const lowerTitle = title?.toLowerCase() || '';

    // Extract metadata first
    const metadata = this.extractMetadata(content, title);
    const wordCount = this.countWords(content);
    const language = this.detectLanguage(url, content, title);

    // Extract code examples
    const codeExamples = this.extractCodeExamples(content);

    // Classify content type
    const contentTypeResult = this.classifyContentType(lowerUrl, lowerContent, lowerTitle);

    return {
      contentType: contentTypeResult.type,
      confidence: contentTypeResult.confidence,
      language,
      wordCount,
      codeExamples,
      metadata,
    };
  }

  private static classifyContentType(
    url: string,
    content: string,
    title: string
  ): { type: string; confidence: number } {
    const scores: Record<string, number> = {};

    // Initialize scores
    Object.keys(this.CONTENT_TYPE_PATTERNS).forEach((type) => {
      scores[type] = 0;
    });

    // URL-based scoring
    Object.entries(this.CONTENT_TYPE_PATTERNS).forEach(([type, patterns]) => {
      patterns.urlPatterns.forEach((pattern) => {
        if (url.includes(pattern)) {
          scores[type] += 0.4;
        }
      });
    });

    // Title-based scoring
    Object.entries(this.CONTENT_TYPE_PATTERNS).forEach(([type, patterns]) => {
      patterns.titlePatterns.forEach((pattern) => {
        if (title.includes(pattern)) {
          scores[type] += 0.3;
        }
      });
    });

    // Content-based scoring
    Object.entries(this.CONTENT_TYPE_PATTERNS).forEach(([type, patterns]) => {
      patterns.keywords.forEach((keyword) => {
        const occurrences = (content.match(new RegExp(keyword, 'gi')) || []).length;
        scores[type] += Math.min(occurrences * 0.1, 0.5);
      });
    });

    // Find the highest scoring type
    let bestType = 'guide'; // default
    let bestScore = 0;

    Object.entries(scores).forEach(([type, score]) => {
      if (score > bestScore) {
        bestType = type;
        bestScore = score;
      }
    });

    // Ensure minimum confidence
    const confidence = Math.min(Math.max(bestScore, 0.1), 1.0);

    return { type: bestType, confidence };
  }

  private static detectLanguage(url: string, content: string, title?: string): string | undefined {
    const combinedText = `${url} ${content} ${title || ''}`.toLowerCase();

    // Look for programming languages
    for (const [lang, indicators] of Object.entries(this.PROGRAMMING_LANGUAGES)) {
      for (const indicator of indicators) {
        if (combinedText.includes(indicator)) {
          return lang;
        }
      }
    }

    // Default language detection (could be enhanced with a proper language detection library)
    return 'en';
  }

  private static extractMetadata(
    content: string,
    title?: string
  ): {
    title?: string;
    description?: string;
    author?: string;
    version?: string;
  } {
    const metadata: any = {};

    if (title) {
      metadata.title = title;
    }

    // Extract description from first paragraph or meta description
    const firstParagraphMatch = content.match(/<p[^>]*>(.*?)<\/p>/i);
    if (firstParagraphMatch) {
      metadata.description = firstParagraphMatch[1]
        .replace(/<[^>]*>/g, '')
        .trim()
        .substring(0, 200);
    }

    // Extract author
    const authorMatch = content.match(/(?:author|by|written by)[:\s]+([^\n\r<]+)/i);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Extract version
    const versionMatch = content.match(/version[:\s]+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1];
    }

    return metadata;
  }

  private static countWords(content: string): number {
    // Remove HTML tags and count words
    const textContent = content.replace(/<[^>]*>/g, ' ');
    const words = textContent.match(/\b\w+\b/g);
    return words ? words.length : 0;
  }

  private static extractCodeExamples(content: string): Array<{
    language: string;
    codeContent: string;
    isValid: boolean;
    lineStart?: number;
    lineEnd?: number;
    context?: string;
  }> {
    const codeBlocks: Array<any> = [];

    // Match fenced code blocks
    const fencedRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = fencedRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      if (code.length > 0) {
        codeBlocks.push({
          language,
          codeContent: code,
          isValid: this.validateCode(code, language),
          context: this.extractCodeContext(content, match.index),
        });
      }
    }

    // Match HTML pre/code blocks
    const htmlCodeRegex =
      /<pre[^>]*><code(?:\s+class="language-(\w+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi;

    while ((match = htmlCodeRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();

      if (code.length > 0) {
        codeBlocks.push({
          language,
          codeContent: code,
          isValid: this.validateCode(code, language),
          context: this.extractCodeContext(content, match.index),
        });
      }
    }

    return codeBlocks;
  }

  private static validateCode(code: string, language: string): boolean {
    // Basic validation - could be enhanced with actual parsers
    if (code.length < 5) return false;

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return this.validateJavaScript(code);
      case 'typescript':
      case 'ts':
        return this.validateTypeScript(code);
      case 'python':
        return this.validatePython(code);
      case 'json':
        return this.validateJSON(code);
      default:
        return true; // Assume valid for unknown languages
    }
  }

  private static validateJavaScript(code: string): boolean {
    // Basic JavaScript validation
    try {
      // Check for balanced braces and parentheses
      const braceCount = (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
      const parenCount = (code.match(/\(/g) || []).length - (code.match(/\)/g) || []).length;

      return braceCount === 0 && parenCount === 0;
    } catch {
      return false;
    }
  }

  private static validateTypeScript(code: string): boolean {
    // Similar to JavaScript but could check for TS-specific syntax
    return this.validateJavaScript(code);
  }

  private static validatePython(code: string): boolean {
    // Basic Python validation - check indentation consistency
    const lines = code.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return false;

    // Check for consistent indentation
    const indentPattern = /^(\s*)/;
    let previousIndent = 0;

    for (const line of lines) {
      if (line.trim().startsWith('#')) continue; // Skip comments

      const match = line.match(indentPattern);
      const currentIndent = match ? match[1].length : 0;

      // Allow reasonable indentation changes
      if (Math.abs(currentIndent - previousIndent) > 8) {
        return false;
      }

      previousIndent = currentIndent;
    }

    return true;
  }

  private static validateJSON(code: string): boolean {
    try {
      JSON.parse(code);
      return true;
    } catch {
      return false;
    }
  }

  private static extractCodeContext(content: string, codePosition: number): string | undefined {
    // Extract surrounding text as context
    const beforeText = content.substring(Math.max(0, codePosition - 200), codePosition);
    const afterText = content.substring(codePosition + 100, codePosition + 300);

    // Find the last sentence before and first sentence after
    const beforeSentence = beforeText.match(/[.!?][^.!?]*$/);
    const afterSentence = afterText.match(/^[^.!?]*[.!?]/);

    let context = '';
    if (beforeSentence) context += beforeSentence[0];
    if (afterSentence) context += ' ' + afterSentence[0];

    return context.trim() || undefined;
  }

  // Store classification results in database
  static async storeClassificationResult(
    prisma: PrismaClient,
    url: string,
    result: ClassificationResult
  ): Promise<string> {
    // Create or update DocMetadata
    const docMetadata = await prisma.docMetadata.upsert({
      where: { sourceUrl: url },
      update: {
        contentType: result.contentType,
        language: result.language,
        wordCount: result.wordCount,
        confidenceScore: result.confidence,
        title: result.metadata.title,
        description: result.metadata.description,
        author: result.metadata.author,
        version: result.metadata.version,
        updatedAt: new Date(),
      },
      create: {
        sourceUrl: url,
        contentType: result.contentType,
        language: result.language,
        wordCount: result.wordCount,
        confidenceScore: result.confidence,
        title: result.metadata.title,
        description: result.metadata.description,
        author: result.metadata.author,
        version: result.metadata.version,
      },
    });

    // Store code examples
    for (const example of result.codeExamples) {
      await prisma.codeExample.create({
        data: {
          docId: docMetadata.id,
          language: example.language,
          codeContent: example.codeContent,
          isValid: example.isValid,
          lineStart: example.lineStart,
          lineEnd: example.lineEnd,
          context: example.context,
        },
      });
    }

    return docMetadata.id;
  }
}
