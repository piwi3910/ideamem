export interface DocumentComparisonResult {
  id: string;
  documentA: DocumentVersion;
  documentB: DocumentVersion;
  changes: DocumentChange[];
  statistics: ComparisonStatistics;
  similarityScore: number;
  timestamp: Date;
}

export interface DocumentVersion {
  id: string;
  title: string;
  content: string;
  version?: string;
  lastModified: Date;
  author?: string;
  language?: string;
  type: 'markdown' | 'code' | 'text' | 'json' | 'yaml';
  metadata?: Record<string, any>;
  lineCount: number;
  wordCount: number;
  characterCount: number;
}

export interface DocumentChange {
  id: string;
  type: 'addition' | 'deletion' | 'modification' | 'move';
  lineNumber: number;
  originalLine?: number;
  content: string;
  originalContent?: string;
  context: {
    before: string[];
    after: string[];
  };
  severity: 'minor' | 'moderate' | 'major';
  category: 'structure' | 'content' | 'format' | 'style';
  description: string;
  confidence: number;
}

export interface ComparisonStatistics {
  totalChanges: number;
  additions: number;
  deletions: number;
  modifications: number;
  moves: number;
  linesAdded: number;
  linesDeleted: number;
  wordsAdded: number;
  wordsDeleted: number;
  charactersAdded: number;
  charactersDeleted: number;
  similarityPercentage: number;
  changesByCategory: Record<string, number>;
  changeBySeverity: Record<string, number>;
}

export interface DiffVisualizationOptions {
  showLineNumbers: boolean;
  highlightSyntax: boolean;
  showInlineChanges: boolean;
  contextLines: number;
  theme: 'light' | 'dark';
  compactMode: boolean;
  showStatistics: boolean;
  showMetadata: boolean;
}

export interface SideBySideView {
  leftDocument: DocumentVersion;
  rightDocument: DocumentVersion;
  alignedLines: AlignedLine[];
  changeBlocks: ChangeBlock[];
}

export interface AlignedLine {
  leftLineNumber?: number;
  rightLineNumber?: number;
  leftContent?: string;
  rightContent?: string;
  changeType?: 'none' | 'addition' | 'deletion' | 'modification' | 'move';
  changeId?: string;
  inlineChanges?: InlineChange[];
}

export interface InlineChange {
  type: 'addition' | 'deletion' | 'modification';
  startIndex: number;
  endIndex: number;
  text: string;
  originalText?: string;
}

export interface ChangeBlock {
  startLine: number;
  endLine: number;
  type: 'addition' | 'deletion' | 'modification' | 'move';
  description: string;
  changes: DocumentChange[];
}

export class DocumentComparisonEngine {
  private static readonly CONTEXT_LINES = 3;
  private static readonly SIMILARITY_THRESHOLD = 0.7;

  static async compareDocuments(
    documentA: DocumentVersion,
    documentB: DocumentVersion,
    options: Partial<DiffVisualizationOptions> = {}
  ): Promise<DocumentComparisonResult> {
    const changes = this.generateChanges(documentA, documentB);
    const statistics = this.calculateStatistics(documentA, documentB, changes);
    const similarityScore = this.calculateSimilarityScore(documentA, documentB, changes);

    return {
      id: `comparison-${Date.now()}`,
      documentA,
      documentB,
      changes,
      statistics,
      similarityScore,
      timestamp: new Date(),
    };
  }

  static generateChanges(documentA: DocumentVersion, documentB: DocumentVersion): DocumentChange[] {
    const linesA = documentA.content.split('\n');
    const linesB = documentB.content.split('\n');
    const changes: DocumentChange[] = [];

    // Use Myers' algorithm for better diff results
    const diffResult = this.myersDiff(linesA, linesB);
    let changeId = 0;

    diffResult.forEach((operation, index) => {
      const change: DocumentChange = {
        id: `change-${changeId++}`,
        type: operation.type,
        lineNumber: operation.lineNumber,
        originalLine: operation.originalLine,
        content: operation.content,
        originalContent: operation.originalContent,
        context: this.getContext(linesA, linesB, operation.lineNumber, operation.originalLine),
        severity: this.determineSeverity(operation),
        category: this.categorizeChange(operation),
        description: this.describeChange(operation),
        confidence: this.calculateConfidence(operation),
      };

      changes.push(change);
    });

    return changes;
  }

  private static myersDiff(linesA: string[], linesB: string[]): DiffOperation[] {
    // Simplified Myers algorithm implementation
    const operations: DiffOperation[] = [];
    const m = linesA.length;
    const n = linesB.length;

    // Build LCS matrix
    const lcs = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (linesA[i - 1].trim() === linesB[j - 1].trim()) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }

    // Backtrack to find operations
    let i = m,
      j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1].trim() === linesB[j - 1].trim()) {
        // No change
        i--;
        j--;
      } else if (i > 0 && (j === 0 || lcs[i - 1][j] >= lcs[i][j - 1])) {
        // Deletion
        operations.unshift({
          type: 'deletion',
          lineNumber: j,
          originalLine: i - 1,
          content: '',
          originalContent: linesA[i - 1],
        });
        i--;
      } else {
        // Addition
        operations.unshift({
          type: 'addition',
          lineNumber: j - 1,
          originalLine: i,
          content: linesB[j - 1],
          originalContent: '',
        });
        j--;
      }
    }

    return operations;
  }

  private static getContext(
    linesA: string[],
    linesB: string[],
    lineNumber: number,
    originalLine?: number
  ): { before: string[]; after: string[] } {
    const contextSize = this.CONTEXT_LINES;

    // Get context from the relevant document
    const lines = originalLine !== undefined ? linesA : linesB;
    const targetLine = originalLine !== undefined ? originalLine : lineNumber;

    const before = lines.slice(Math.max(0, targetLine - contextSize), targetLine);

    const after = lines.slice(targetLine + 1, Math.min(lines.length, targetLine + 1 + contextSize));

    return { before, after };
  }

  private static determineSeverity(operation: DiffOperation): 'minor' | 'moderate' | 'major' {
    const content = operation.content || operation.originalContent || '';
    const contentLength = content.length;

    if (
      contentLength > 200 ||
      content.includes('function') ||
      content.includes('class') ||
      content.includes('interface')
    ) {
      return 'major';
    } else if (
      contentLength > 50 ||
      content.includes('import') ||
      content.includes('const') ||
      content.includes('let')
    ) {
      return 'moderate';
    } else {
      return 'minor';
    }
  }

  private static categorizeChange(
    operation: DiffOperation
  ): 'structure' | 'content' | 'format' | 'style' {
    const content = operation.content || operation.originalContent || '';
    const contentLower = content.toLowerCase().trim();

    if (
      contentLower.includes('function') ||
      contentLower.includes('class') ||
      contentLower.includes('interface') ||
      contentLower.includes('type') ||
      contentLower.includes('import') ||
      contentLower.includes('export')
    ) {
      return 'structure';
    } else if (contentLower.match(/^\s*\/\/|^\s*\/\*|^\s*\*|^\s*#/)) {
      return 'content'; // Comments
    } else if (contentLower.match(/^\s*$/) || content.match(/^\s+/) || content.includes('\t')) {
      return 'format'; // Whitespace changes
    } else {
      return 'content';
    }
  }

  private static describeChange(operation: DiffOperation): string {
    const type = operation.type;
    const content = (operation.content || operation.originalContent || '').trim();
    const shortContent = content.length > 50 ? content.slice(0, 50) + '...' : content;

    switch (type) {
      case 'addition':
        return `Added line: "${shortContent}"`;
      case 'deletion':
        return `Deleted line: "${shortContent}"`;
      case 'modification':
        return `Modified line: "${shortContent}"`;
      default:
        return `Changed line: "${shortContent}"`;
    }
  }

  private static calculateConfidence(operation: DiffOperation): number {
    // Simple confidence calculation based on operation characteristics
    const content = operation.content || operation.originalContent || '';

    if (content.trim().length === 0) {
      return 0.5; // Whitespace changes are less confident
    }

    if (content.includes('//') || content.includes('/*') || content.includes('#')) {
      return 0.8; // Comments have good confidence
    }

    if (content.match(/^[a-zA-Z_][a-zA-Z0-9_]*\s*[=:]/)) {
      return 0.9; // Variable assignments are very confident
    }

    return 0.85; // Default confidence
  }

  static calculateStatistics(
    documentA: DocumentVersion,
    documentB: DocumentVersion,
    changes: DocumentChange[]
  ): ComparisonStatistics {
    const additions = changes.filter((c) => c.type === 'addition').length;
    const deletions = changes.filter((c) => c.type === 'deletion').length;
    const modifications = changes.filter((c) => c.type === 'modification').length;
    const moves = changes.filter((c) => c.type === 'move').length;

    const linesAdded = changes
      .filter((c) => c.type === 'addition')
      .reduce((sum, c) => sum + (c.content.split('\n').length || 1), 0);

    const linesDeleted = changes
      .filter((c) => c.type === 'deletion')
      .reduce((sum, c) => sum + (c.originalContent?.split('\n').length || 1), 0);

    const wordsAdded = changes
      .filter((c) => c.type === 'addition')
      .reduce((sum, c) => sum + (c.content.split(/\s+/).length || 0), 0);

    const wordsDeleted = changes
      .filter((c) => c.type === 'deletion')
      .reduce((sum, c) => sum + (c.originalContent?.split(/\s+/).length || 0), 0);

    const charactersAdded = changes
      .filter((c) => c.type === 'addition')
      .reduce((sum, c) => sum + c.content.length, 0);

    const charactersDeleted = changes
      .filter((c) => c.type === 'deletion')
      .reduce((sum, c) => sum + (c.originalContent?.length || 0), 0);

    const changesByCategory = changes.reduce(
      (acc, change) => {
        acc[change.category] = (acc[change.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const changeBySeverity = changes.reduce(
      (acc, change) => {
        acc[change.severity] = (acc[change.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate similarity based on unchanged content
    const totalLines = Math.max(documentA.lineCount, documentB.lineCount);
    const unchangedLines = totalLines - additions - deletions - modifications;
    const similarityPercentage = totalLines > 0 ? (unchangedLines / totalLines) * 100 : 100;

    return {
      totalChanges: changes.length,
      additions,
      deletions,
      modifications,
      moves,
      linesAdded,
      linesDeleted,
      wordsAdded,
      wordsDeleted,
      charactersAdded,
      charactersDeleted,
      similarityPercentage: Math.max(0, Math.min(100, similarityPercentage)),
      changesByCategory,
      changeBySeverity,
    };
  }

  static calculateSimilarityScore(
    documentA: DocumentVersion,
    documentB: DocumentVersion,
    changes: DocumentChange[]
  ): number {
    const totalLines = Math.max(documentA.lineCount, documentB.lineCount);
    if (totalLines === 0) return 1.0;

    const significantChanges = changes.filter(
      (c) => c.severity === 'major' || c.severity === 'moderate'
    ).length;

    const score = 1 - significantChanges / totalLines;
    return Math.max(0, Math.min(1, score));
  }

  static generateSideBySideView(comparison: DocumentComparisonResult): SideBySideView {
    const linesA = comparison.documentA.content.split('\n');
    const linesB = comparison.documentB.content.split('\n');
    const alignedLines: AlignedLine[] = [];
    const changeBlocks: ChangeBlock[] = [];

    let indexA = 0;
    let indexB = 0;
    let currentBlock: ChangeBlock | null = null;

    // Process each change to create aligned view
    const sortedChanges = [...comparison.changes].sort((a, b) => a.lineNumber - b.lineNumber);

    for (const change of sortedChanges) {
      // Add unchanged lines before this change
      while (indexA < (change.originalLine || change.lineNumber) && indexB < change.lineNumber) {
        alignedLines.push({
          leftLineNumber: indexA + 1,
          rightLineNumber: indexB + 1,
          leftContent: linesA[indexA] || '',
          rightContent: linesB[indexB] || '',
          changeType: 'none',
        });
        indexA++;
        indexB++;
      }

      // Process the change
      const alignedLine: AlignedLine = {
        changeType: change.type,
        changeId: change.id,
      };

      switch (change.type) {
        case 'addition':
          alignedLine.rightLineNumber = indexB + 1;
          alignedLine.rightContent = change.content;
          alignedLine.leftContent = '';
          indexB++;
          break;

        case 'deletion':
          alignedLine.leftLineNumber = indexA + 1;
          alignedLine.leftContent = change.originalContent || '';
          alignedLine.rightContent = '';
          indexA++;
          break;

        case 'modification':
          alignedLine.leftLineNumber = indexA + 1;
          alignedLine.rightLineNumber = indexB + 1;
          alignedLine.leftContent = change.originalContent || '';
          alignedLine.rightContent = change.content;
          alignedLine.inlineChanges = this.detectInlineChanges(
            change.originalContent || '',
            change.content
          );
          indexA++;
          indexB++;
          break;
      }

      alignedLines.push(alignedLine);

      // Update change blocks
      if (currentBlock && currentBlock.type === change.type) {
        currentBlock.endLine = change.lineNumber;
        currentBlock.changes.push(change);
      } else {
        if (currentBlock) {
          changeBlocks.push(currentBlock);
        }
        currentBlock = {
          startLine: change.lineNumber,
          endLine: change.lineNumber,
          type: change.type,
          description: change.description,
          changes: [change],
        };
      }
    }

    // Add final change block
    if (currentBlock) {
      changeBlocks.push(currentBlock);
    }

    // Add remaining unchanged lines
    while (indexA < linesA.length || indexB < linesB.length) {
      alignedLines.push({
        leftLineNumber: indexA < linesA.length ? indexA + 1 : undefined,
        rightLineNumber: indexB < linesB.length ? indexB + 1 : undefined,
        leftContent: linesA[indexA] || '',
        rightContent: linesB[indexB] || '',
        changeType: 'none',
      });
      indexA++;
      indexB++;
    }

    return {
      leftDocument: comparison.documentA,
      rightDocument: comparison.documentB,
      alignedLines,
      changeBlocks,
    };
  }

  static detectInlineChanges(originalText: string, newText: string): InlineChange[] {
    // Simple word-level diff for inline changes
    const originalWords = originalText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    const inlineChanges: InlineChange[] = [];

    let originalIndex = 0;
    let newIndex = 0;
    let charPosition = 0;

    while (originalIndex < originalWords.length || newIndex < newWords.length) {
      const originalWord = originalWords[originalIndex] || '';
      const newWord = newWords[newIndex] || '';

      if (originalWord === newWord) {
        // No change
        charPosition += newWord.length;
        originalIndex++;
        newIndex++;
      } else if (originalIndex >= originalWords.length) {
        // Addition
        inlineChanges.push({
          type: 'addition',
          startIndex: charPosition,
          endIndex: charPosition + newWord.length,
          text: newWord,
        });
        charPosition += newWord.length;
        newIndex++;
      } else if (newIndex >= newWords.length) {
        // Deletion (represented as empty in new text)
        inlineChanges.push({
          type: 'deletion',
          startIndex: charPosition,
          endIndex: charPosition,
          text: '',
          originalText: originalWord,
        });
        originalIndex++;
      } else {
        // Modification
        inlineChanges.push({
          type: 'modification',
          startIndex: charPosition,
          endIndex: charPosition + newWord.length,
          text: newWord,
          originalText: originalWord,
        });
        charPosition += newWord.length;
        originalIndex++;
        newIndex++;
      }
    }

    return inlineChanges;
  }

  // Utility methods for document processing
  static createDocumentVersion(
    title: string,
    content: string,
    options: Partial<DocumentVersion> = {}
  ): DocumentVersion {
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(Boolean);

    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      content,
      lastModified: new Date(),
      type: 'text',
      lineCount: lines.length,
      wordCount: words.length,
      characterCount: content.length,
      ...options,
    };
  }

  static exportComparison(
    comparison: DocumentComparisonResult,
    format: 'json' | 'csv' | 'html'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(comparison, null, 2);

      case 'csv':
        return this.generateCsvReport(comparison);

      case 'html':
        return this.generateHtmlReport(comparison);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private static generateCsvReport(comparison: DocumentComparisonResult): string {
    const headers = ['Line', 'Type', 'Content', 'Severity', 'Category', 'Description'];
    const rows = comparison.changes.map((change) => [
      change.lineNumber.toString(),
      change.type,
      `"${change.content.replace(/"/g, '""')}"`,
      change.severity,
      change.category,
      `"${change.description.replace(/"/g, '""')}"`,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  private static generateHtmlReport(comparison: DocumentComparisonResult): string {
    // Simple HTML report generation
    return `
      <html>
        <head><title>Document Comparison Report</title></head>
        <body>
          <h1>Document Comparison</h1>
          <h2>Documents</h2>
          <p><strong>A:</strong> ${comparison.documentA.title}</p>
          <p><strong>B:</strong> ${comparison.documentB.title}</p>
          
          <h2>Statistics</h2>
          <p>Total Changes: ${comparison.statistics.totalChanges}</p>
          <p>Similarity: ${comparison.statistics.similarityPercentage.toFixed(1)}%</p>
          
          <h2>Changes</h2>
          ${comparison.changes
            .map(
              (change) => `
            <div style="border: 1px solid #ccc; padding: 10px; margin: 5px 0;">
              <strong>Line ${change.lineNumber}:</strong> ${change.type}<br>
              <em>${change.description}</em><br>
              <code>${change.content}</code>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `;
  }
}

interface DiffOperation {
  type: 'addition' | 'deletion' | 'modification';
  lineNumber: number;
  originalLine?: number;
  content: string;
  originalContent?: string;
}
