import { BaseParser, ParseResult, SemanticChunk } from './types';

export class CSSParser extends BaseParser {
  language = 'css';
  fileExtensions = ['.css', '.scss', '.sass', '.less', '.stylus'];

  parse(content: string, source?: string): ParseResult {
    try {
      // Dynamic import for PostCSS
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const postcss = require('postcss');
      
      // Parse CSS with PostCSS
      const root = postcss.parse(content, { from: source });
      
      const chunks: SemanticChunk[] = [];
      const lineCounter = 1;
      
      // Walk through all nodes in the CSS AST
      root.walkRules((rule: any) => {
        const startLine = this.getNodeLine(content, rule.source?.start?.offset || 0);
        const endLine = this.getNodeLine(content, rule.source?.end?.offset || 0);
        
        chunks.push({
          content: rule.toString(),
          type: 'config', // CSS rules are configuration
          name: this.getSelectorName(rule.selector),
          startLine,
          endLine,
          metadata: {
            language: 'css',
            selector: rule.selector,
            properties: this.extractProperties(rule),
            dependencies: this.extractImports(content),
            exports: [],
          }
        });
      });

      // Handle @rules (imports, media queries, keyframes, etc.)
      root.walkAtRules((atRule: any) => {
        const startLine = this.getNodeLine(content, atRule.source?.start?.offset || 0);
        const endLine = this.getNodeLine(content, atRule.source?.end?.offset || 0);
        
        const chunkType = this.getAtRuleType(atRule.name);
        
        chunks.push({
          content: atRule.toString(),
          type: chunkType,
          name: `@${atRule.name} ${atRule.params}`.trim(),
          startLine,
          endLine,
          metadata: {
            language: 'css',
            atRuleName: atRule.name,
            atRuleParams: atRule.params,
            dependencies: atRule.name === 'import' ? [atRule.params.replace(/['"]/g, '')] : [],
            exports: [],
          }
        });
      });

      // Handle CSS comments as documentation
      root.walkComments((comment: any) => {
        const startLine = this.getNodeLine(content, comment.source?.start?.offset || 0);
        const endLine = this.getNodeLine(content, comment.source?.end?.offset || 0);
        
        chunks.push({
          content: comment.toString(),
          type: 'text',
          name: 'comment',
          startLine,
          endLine,
          metadata: {
            language: 'css',
            dependencies: [],
            exports: [],
          }
        });
      });

      // If no meaningful chunks found, create one for the entire content
      if (chunks.length === 0) {
        chunks.push({
          content: content,
          type: 'config',
          name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'stylesheet' : 'stylesheet',
          startLine: 1,
          endLine: content.split('\n').length,
          metadata: {
            language: 'css',
            dependencies: this.extractImports(content),
            exports: [],
          }
        });
      }

      return {
        success: true,
        chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
        language: 'css',
        metadata: {
          totalChunks: chunks.length,
          parser: 'postcss-ast',
        }
      };

    } catch (error) {
      // Fallback to simple chunking if PostCSS parsing fails
      console.warn(`PostCSS parsing failed for ${source || 'unknown'}, using fallback chunking:`, error);
      
      return this.createFallbackChunks(content, source);
    }
  }

  private getNodeLine(content: string, offset: number): number {
    if (!offset) return 1;
    return content.substring(0, offset).split('\n').length;
  }

  private getSelectorName(selector: string): string {
    // Extract a meaningful name from CSS selector
    const cleaned = selector.replace(/[^\w\-\#\.]/g, ' ').trim();
    if (cleaned.length > 30) {
      return cleaned.substring(0, 30) + '...';
    }
    return cleaned || 'selector';
  }

  private extractProperties(rule: any): string[] {
    const properties: string[] = [];
    rule.walkDecls((decl: any) => {
      properties.push(decl.prop);
    });
    return properties;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Extract @import statements
    const importRegex = /@import\s+['"]([^'"]+)['"];?/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Extract url() references
    const urlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
    while ((match = urlRegex.exec(content)) !== null) {
      if (!match[1].startsWith('data:') && !match[1].startsWith('http')) {
        imports.push(match[1]);
      }
    }
    
    return Array.from(new Set(imports));
  }

  private getAtRuleType(ruleName: string): SemanticChunk['type'] {
    switch (ruleName) {
      case 'import':
        return 'import';
      case 'media':
      case 'supports':
      case 'container':
        return 'config';
      case 'keyframes':
      case 'counter-style':
        return 'function';
      case 'font-face':
      case 'page':
        return 'config';
      default:
        return 'config';
    }
  }

  private createFallbackChunks(content: string, source?: string): ParseResult {
    const lines = content.split('\n');
    const chunks: SemanticChunk[] = [];
    
    // Try to split by CSS rules (simple regex approach)
    const ruleMatches = content.match(/[^{}]+\{[^{}]*\}/g);
    
    if (ruleMatches && ruleMatches.length > 0) {
      let currentLine = 1;
      for (const ruleContent of ruleMatches) {
        const ruleLines = ruleContent.split('\n').length;
        const selector = ruleContent.split('{')[0].trim();
        
        chunks.push({
          content: ruleContent.trim(),
          type: 'config',
          name: this.getSelectorName(selector),
          startLine: currentLine,
          endLine: currentLine + ruleLines - 1,
          metadata: {
            language: 'css',
            dependencies: [],
            exports: [],
          }
        });
        
        currentLine += ruleLines;
      }
    } else {
      // Ultimate fallback - treat as single chunk
      chunks.push({
        content: content,
        type: 'config',
        name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'stylesheet' : 'stylesheet',
        startLine: 1,
        endLine: lines.length,
        metadata: {
          language: 'css',
          dependencies: [],
          exports: [],
        }
      });
    }

    return {
      success: false,
      chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
      error: 'PostCSS parsing failed, used fallback',
      fallbackUsed: true,
    };
  }
}