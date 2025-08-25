// Parser interfaces and types for multi-language semantic understanding

export interface SemanticChunk {
  type:
    | 'function'
    | 'class'
    | 'method'
    | 'variable'
    | 'interface'
    | 'type'
    | 'import'
    | 'resource'
    | 'task'
    | 'play'
    | 'service'
    | 'config'
    | 'object'
    | 'array_section'
    | 'instruction'
    | 'stage'
    | 'module'
    | 'struct'
    | 'package'
    | 'constant'
    | 'heading'
    | 'text'
    | 'code-block'
    | 'list'
    | 'quote'
    | 'table'
    | 'image'
    | 'link'
    | 'document'
    | 'export'
    | 'code'
    | 'enum';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  metadata: {
    language: string;
    parent?: string;
    dependencies?: string[];
    exports?: string[];
    decorators?: string[];
    parameters?: string[];
    returnType?: string;
    visibility?: 'public' | 'private' | 'protected';
    async?: boolean;
    static?: boolean;
    abstract?: boolean;
    // Markdown-specific metadata
    headingLevel?: number;
    codeLanguage?: string;
    // TypeScript-specific metadata  
    nodeKind?: string;
    exported?: boolean;
  };
}

export interface ParseResult {
  chunks: SemanticChunk[];
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
  language?: string;
  metadata?: {
    totalChunks: number;
    parser: string;
  };
}

export abstract class BaseParser {
  abstract language: string;
  abstract fileExtensions: string[];

  abstract parse(content: string, source?: string): ParseResult;

  protected createChunk(
    type: SemanticChunk['type'],
    name: string,
    content: string,
    startLine: number,
    endLine: number,
    metadata: Partial<SemanticChunk['metadata']> = {}
  ): SemanticChunk {
    return {
      type,
      name,
      content,
      startLine,
      endLine,
      metadata: {
        language: this.language,
        ...metadata,
      },
    };
  }

  protected getLineNumber(content: string, position: number): number {
    return content.substring(0, position).split('\n').length;
  }

  protected extractLines(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    return lines.slice(startLine - 1, endLine).join('\n');
  }
}

export const SUPPORTED_LANGUAGES = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdown': 'markdown',
  '.mkd': 'markdown',
  '.mdx': 'markdown',
  '.py': 'python',
  '.go': 'go',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  Dockerfile: 'dockerfile',
  '.dockerfile': 'dockerfile',
  '.tf': 'terraform',
  '.tfvars': 'terraform',
  '.rb': 'ruby',
  '.java': 'java',
  '.cs': 'csharp',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.hh': 'cpp',
} as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES];
