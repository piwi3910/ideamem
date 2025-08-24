import { BaseParser, SemanticChunk, ParseResult } from './types';

export class JSONParser extends BaseParser {
  language = 'json';
  fileExtensions = ['.json'];

  parse(content: string, source?: string): ParseResult {
    try {
      const parsed = JSON.parse(content);
      const chunks = this.extractSemanticChunks(parsed, content, source);
      
      return {
        chunks,
        success: true
      };
    } catch (error) {
      return {
        chunks: [{
          type: 'object',
          name: source ? `${source} (parse error)` : 'json-content',
          content,
          startLine: 1,
          endLine: content.split('\n').length,
          metadata: {
            language: this.language,
            dependencies: []
          }
        }],
        success: false,
        error: error instanceof Error ? error.message : 'JSON parsing failed',
        fallbackUsed: true
      };
    }
  }

  private extractSemanticChunks(obj: any, originalContent: string, source?: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = originalContent.split('\n');

    // Handle common JSON file types
    if (source?.includes('package.json')) {
      chunks.push(...this.parsePackageJson(obj, lines));
    } else if (source?.includes('tsconfig.json') || source?.includes('jsconfig.json')) {
      chunks.push(...this.parseTsConfig(obj, lines));
    } else if (source?.includes('schema')) {
      chunks.push(...this.parseSchema(obj, lines));
    } else {
      // Generic JSON parsing
      chunks.push(...this.parseGenericJson(obj, lines));
    }

    return chunks;
  }

  private parsePackageJson(pkg: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Main package info
    chunks.push(this.createChunk(
      'config',
      'package-info',
      JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        main: pkg.main,
        author: pkg.author,
        license: pkg.license
      }, null, 2),
      1,
      Math.min(15, lines.length),
      { dependencies: [] }
    ));

    // Dependencies
    if (pkg.dependencies) {
      chunks.push(this.createChunk(
        'config',
        'dependencies',
        JSON.stringify({ dependencies: pkg.dependencies }, null, 2),
        this.findLineContaining(lines, '"dependencies"'),
        this.findLineContaining(lines, '"dependencies"') + Object.keys(pkg.dependencies).length + 2,
        { dependencies: Object.keys(pkg.dependencies) }
      ));
    }

    // Dev dependencies
    if (pkg.devDependencies) {
      chunks.push(this.createChunk(
        'config',
        'devDependencies',
        JSON.stringify({ devDependencies: pkg.devDependencies }, null, 2),
        this.findLineContaining(lines, '"devDependencies"'),
        this.findLineContaining(lines, '"devDependencies"') + Object.keys(pkg.devDependencies).length + 2,
        { dependencies: Object.keys(pkg.devDependencies) }
      ));
    }

    // Scripts
    if (pkg.scripts) {
      chunks.push(this.createChunk(
        'config',
        'scripts',
        JSON.stringify({ scripts: pkg.scripts }, null, 2),
        this.findLineContaining(lines, '"scripts"'),
        this.findLineContaining(lines, '"scripts"') + Object.keys(pkg.scripts).length + 2,
        { exports: Object.keys(pkg.scripts) }
      ));
    }

    return chunks;
  }

  private parseTsConfig(config: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    // Compiler options
    if (config.compilerOptions) {
      chunks.push(this.createChunk(
        'config',
        'compilerOptions',
        JSON.stringify({ compilerOptions: config.compilerOptions }, null, 2),
        this.findLineContaining(lines, '"compilerOptions"'),
        this.findLineContaining(lines, '"compilerOptions"') + Object.keys(config.compilerOptions).length + 5,
        {}
      ));
    }

    // Include/exclude patterns
    if (config.include) {
      chunks.push(this.createChunk(
        'config',
        'include',
        JSON.stringify({ include: config.include }, null, 2),
        this.findLineContaining(lines, '"include"'),
        this.findLineContaining(lines, '"include"') + config.include.length + 2,
        {}
      ));
    }

    if (config.exclude) {
      chunks.push(this.createChunk(
        'config',
        'exclude',
        JSON.stringify({ exclude: config.exclude }, null, 2),
        this.findLineContaining(lines, '"exclude"'),
        this.findLineContaining(lines, '"exclude"') + config.exclude.length + 2,
        {}
      ));
    }

    return chunks;
  }

  private parseSchema(schema: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (schema.definitions) {
      Object.entries(schema.definitions).forEach(([name, def]) => {
        chunks.push(this.createChunk(
          'type',
          `schema-${name}`,
          JSON.stringify({ [name]: def }, null, 2),
          this.findLineContaining(lines, `"${name}"`),
          this.findLineContaining(lines, `"${name}"`) + 10,
          {}
        ));
      });
    }

    if (schema.properties) {
      chunks.push(this.createChunk(
        'interface',
        'schema-properties',
        JSON.stringify({ properties: schema.properties }, null, 2),
        this.findLineContaining(lines, '"properties"'),
        this.findLineContaining(lines, '"properties"') + Object.keys(schema.properties).length * 3,
        { exports: Object.keys(schema.properties) }
      ));
    }

    return chunks;
  }

  private parseGenericJson(obj: any, lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];

    if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const chunkContent = JSON.stringify({ [key]: value }, null, 2);
          const startLine = this.findLineContaining(lines, `"${key}"`);
          
          chunks.push(this.createChunk(
            Array.isArray(value) ? 'array_section' : 'object',
            key,
            chunkContent,
            startLine,
            startLine + chunkContent.split('\n').length,
            {}
          ));
        }
      });

      // If no complex objects found, treat as single config
      if (chunks.length === 0) {
        chunks.push(this.createChunk(
          'config',
          'json-config',
          JSON.stringify(obj, null, 2),
          1,
          lines.length,
          { exports: Object.keys(obj) }
        ));
      }
    }

    return chunks;
  }

  private findLineContaining(lines: string[], text: string): number {
    const lineIndex = lines.findIndex(line => line.includes(text));
    return lineIndex >= 0 ? lineIndex + 1 : 1;
  }
}