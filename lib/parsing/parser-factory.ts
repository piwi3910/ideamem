import { BaseParser, SemanticChunk, ParseResult, SUPPORTED_LANGUAGES } from './types';
import { JSONParser } from './json-parser';
import { YAMLParser } from './yaml-parser';
import { PythonParser } from './python-parser';
import { GoParser } from './go-parser';
import { DockerfileParser } from './dockerfile-parser';
import { AnsibleParser } from './ansible-parser';
import { TerraformParser } from './terraform-parser';
import { TypeScriptParser } from './typescript-parser';
import { MarkdownParser } from './markdown-parser';
import { CSSParser } from './css-parser';

export class ParserFactory {
  private parsers: Map<string, BaseParser>;
  private fileExtensionMap: Map<string, BaseParser>;

  constructor() {
    this.parsers = new Map();
    this.fileExtensionMap = new Map();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    const parsers = [
      new TypeScriptParser(),
      new MarkdownParser(),
      new CSSParser(),
      new JSONParser(),
      new YAMLParser(),
      new PythonParser(),
      new GoParser(),
      new DockerfileParser(),
      new AnsibleParser(),
      new TerraformParser(),
    ];

    for (const parser of parsers) {
      this.parsers.set(parser.language, parser);

      // Map file extensions to parsers
      for (const ext of parser.fileExtensions) {
        this.fileExtensionMap.set(ext.toLowerCase(), parser);
      }
    }
  }

  /**
   * Parse content with automatic language detection
   */
  parse(content: string, source?: string, language?: string): ParseResult {
    const parser = this.getParser(source, language, content);

    if (!parser) {
      return this.createFallbackResult(content, source, 'No suitable parser found');
    }

    return parser.parse(content, source);
  }

  /**
   * Get appropriate parser based on file source, language hint, or content analysis
   */
  private getParser(source?: string, language?: string, content?: string): BaseParser | null {
    // 1. Use explicit language if provided
    if (language) {
      const parser = this.parsers.get(language.toLowerCase());
      if (parser) return parser;
    }

    // 2. Detect by file extension
    if (source) {
      const parser = this.detectByFileExtension(source);
      if (parser) return parser;
    }

    // 3. Detect by file name patterns
    if (source) {
      const parser = this.detectByFileName(source);
      if (parser) return parser;
    }

    // 4. Detect by content analysis
    if (content) {
      const parser = this.detectByContent(content, source);
      if (parser) return parser;
    }

    return null;
  }

  private detectByFileExtension(source: string): BaseParser | null {
    const fileName = source.toLowerCase();

    // Check exact filename matches first (e.g., Dockerfile)
    const extensions = Array.from(this.fileExtensionMap.keys());
    for (const ext of extensions) {
      if (fileName.endsWith(ext.toLowerCase())) {
        return this.fileExtensionMap.get(ext) || null;
      }
    }

    // Extract file extension
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return null;

    const extension = fileName.substring(lastDot);
    return this.fileExtensionMap.get(extension) || null;
  }

  private detectByFileName(source: string): BaseParser | null {
    const fileName = source.toLowerCase();
    const baseName = source.split('/').pop()?.toLowerCase() || '';

    // Dockerfile patterns
    if (
      baseName === 'dockerfile' ||
      baseName.includes('dockerfile') ||
      fileName.includes('.dockerfile')
    ) {
      return this.parsers.get('dockerfile') || null;
    }

    // Ansible patterns
    if (
      fileName.includes('playbook') ||
      fileName.includes('ansible') ||
      fileName.includes('roles/') ||
      fileName.includes('tasks/') ||
      fileName.includes('handlers/')
    ) {
      return this.parsers.get('yaml') || null; // Ansible uses YAML parser
    }

    // Terraform patterns
    if (fileName.includes('.tfvars') || fileName.includes('.tf')) {
      return this.parsers.get('terraform') || null;
    }

    return null;
  }

  private detectByContent(content: string, source?: string): BaseParser | null {
    const firstLines = content.split('\n').slice(0, 10).join('\n').toLowerCase();

    // Python detection
    if (this.isPythonContent(firstLines)) {
      return this.parsers.get('python') || null;
    }

    // Go detection
    if (this.isGoContent(firstLines)) {
      return this.parsers.get('go') || null;
    }

    // JSON detection
    if (this.isJSONContent(content)) {
      return this.parsers.get('json') || null;
    }

    // YAML detection
    if (this.isYAMLContent(firstLines, source)) {
      // Check if it's Ansible content
      if (this.isAnsibleContent(content, source)) {
        return this.parsers.get('ansible') || null; // Use Ansible parser for Ansible content
      }
      return this.parsers.get('yaml') || null;
    }

    // Dockerfile detection
    if (this.isDockerfileContent(firstLines)) {
      return this.parsers.get('dockerfile') || null;
    }

    // Terraform/HCL detection
    if (this.isTerraformContent(firstLines)) {
      return this.parsers.get('terraform') || null;
    }

    return null;
  }

  private isPythonContent(content: string): boolean {
    const pythonPatterns = [
      /^#!.*python/,
      /import \w+/,
      /from \w+ import/,
      /def \w+\(/,
      /class \w+/,
      /if __name__ == ['"]__main__['"]/,
    ];

    return pythonPatterns.some((pattern) => pattern.test(content));
  }

  private isGoContent(content: string): boolean {
    const goPatterns = [
      /package \w+/,
      /import \(/,
      /func \w+/,
      /type \w+ struct/,
      /var \w+ /,
      /const \w+ /,
    ];

    return goPatterns.some((pattern) => pattern.test(content));
  }

  private isJSONContent(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false;
    }

    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }

  private isYAMLContent(content: string, source?: string): boolean {
    const yamlPatterns = [
      /^---/,
      /^\w+:\s/,
      /^  \w+:/,
      /^- \w+/,
      /version:\s*['"]?\d/,
      /apiversion:/i,
    ];

    return yamlPatterns.some((pattern) => pattern.test(content));
  }

  private isAnsibleContent(content: string, source?: string): boolean {
    // Check file path indicators
    if (source) {
      const lowerSource = source.toLowerCase();
      if (
        lowerSource.includes('playbook') ||
        lowerSource.includes('ansible') ||
        lowerSource.includes('roles/') ||
        lowerSource.includes('tasks/') ||
        lowerSource.includes('handlers/')
      ) {
        return true;
      }
    }

    // Check content indicators
    const ansibleKeywords = [
      'hosts:',
      'become:',
      'tasks:',
      'handlers:',
      'vars:',
      'defaults:',
      'roles:',
      'name:',
      'ansible_',
      'gather_facts:',
      'remote_user:',
    ];

    const lowerContent = content.toLowerCase();
    return ansibleKeywords.some((keyword) => lowerContent.includes(keyword));
  }

  private isDockerfileContent(content: string): boolean {
    const dockerfilePatterns = [
      /^from \w+/i,
      /^run \w+/i,
      /^copy \w+/i,
      /^add \w+/i,
      /^workdir /i,
      /^expose \d+/i,
      /^cmd \[/i,
      /^entrypoint \[/i,
    ];

    return dockerfilePatterns.some((pattern) => pattern.test(content));
  }

  private isTerraformContent(content: string): boolean {
    const terraformPatterns = [
      /^resource "/,
      /^data "/,
      /^provider "/,
      /^module "/,
      /^variable "/,
      /^output "/,
      /^locals \{/,
      /^terraform \{/,
    ];

    return terraformPatterns.some((pattern) => pattern.test(content));
  }

  private createFallbackResult(content: string, source?: string, error?: string): ParseResult {
    const lines = content.split('\n');
    const fallbackChunk: SemanticChunk = {
      type: 'config',
      name: source ? source.replace(/.*\//, '') : 'unknown-content',
      content,
      startLine: 1,
      endLine: lines.length,
      metadata: {
        language: 'text',
        dependencies: [],
      },
    };

    return {
      chunks: [fallbackChunk],
      success: false,
      error: error || 'Unknown content type',
      fallbackUsed: true,
    };
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Get all supported file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.fileExtensionMap.keys());
  }

  /**
   * Get parser for a specific language
   */
  getParserForLanguage(language: string): BaseParser | null {
    return this.parsers.get(language.toLowerCase()) || null;
  }

  /**
   * Check if a file extension is supported
   */
  isExtensionSupported(extension: string): boolean {
    return this.fileExtensionMap.has(extension.toLowerCase());
  }

  /**
   * Batch parse multiple files
   */
  async batchParse(
    files: Array<{
      content: string;
      source: string;
      language?: string;
    }>
  ): Promise<Array<ParseResult & { source: string }>> {
    const results: Array<ParseResult & { source: string }> = [];

    for (const file of files) {
      const result = this.parse(file.content, file.source, file.language);
      results.push({
        ...result,
        source: file.source,
      });
    }

    return results;
  }
}

// Singleton instance
export const parserFactory = new ParserFactory();
