import { BaseParser, ParseResult, SemanticChunk } from './types';

export class TypeScriptParser extends BaseParser {
  language = 'typescript';
  fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

  parse(content: string, source?: string): ParseResult {
    try {
      // Use TypeScript compiler API for proper AST parsing
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ts = require('typescript');
      
      // Determine the appropriate script kind based on file extension
      let scriptKind = ts.ScriptKind.TS;
      if (source?.endsWith('.tsx')) {
        scriptKind = ts.ScriptKind.TSX;
      } else if (source?.endsWith('.jsx')) {
        scriptKind = ts.ScriptKind.JSX;
      } else if (source?.endsWith('.js') || source?.endsWith('.mjs') || source?.endsWith('.cjs')) {
        scriptKind = ts.ScriptKind.JS;
      }

      // Create source file for AST parsing
      const sourceFile = ts.createSourceFile(
        source || 'temp.ts',
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      );

      const chunks: SemanticChunk[] = [];
      const lines = content.split('\n');

      // Visit all nodes in the AST
      const visit = (node: any) => {
        const start = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const end = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());
        
        // Extract the actual content for this node
        const nodeContent = content.substring(node.getStart(sourceFile), node.getEnd());
        
        // Only create chunks for meaningful top-level declarations
        if (this.isChunkableNode(node, sourceFile)) {
          const chunkName = this.getNodeName(node);
          const chunkType = this.getNodeType(node);
          
          chunks.push({
            content: nodeContent,
            type: chunkType,
            name: chunkName,
            startLine: start.line + 1,
            endLine: end.line + 1,
            metadata: {
              language: this.getLanguageFromExtension(source),
              dependencies: this.extractImportsFromNode(sourceFile),
              exports: this.extractExportsFromNode(sourceFile),
              nodeKind: ts.SyntaxKind[node.kind],
              async: this.isAsyncNode(node),
              exported: this.isExported(node),
              parameters: this.getParameters(node),
            }
          });
        }

        // Continue visiting child nodes
        ts.forEachChild(node, visit);
      };

      // Start visiting from the root
      visit(sourceFile);

      // If no meaningful chunks found, create file-level chunks
      if (chunks.length === 0) {
        // Try to create chunks for imports, exports, and main content
        const imports = this.extractImportsFromNode(sourceFile);
        const exports = this.extractExportsFromNode(sourceFile);
        
        if (imports.length > 0 || exports.length > 0 || content.trim().length > 0) {
          chunks.push({
            content: content,
            type: 'module',
            name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'unknown' : 'unknown',
            startLine: 1,
            endLine: lines.length,
            metadata: {
              language: this.getLanguageFromExtension(source),
              dependencies: imports,
              exports: exports,
            }
          });
        }
      }

      return {
        success: true,
        chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
        language: this.getLanguageFromExtension(source),
        metadata: {
          totalChunks: chunks.length,
          parser: 'typescript-ast',
        }
      };

    } catch (error) {
      // Fallback to simple chunking if AST parsing fails
      console.warn(`TypeScript AST parsing failed for ${source || 'unknown'}, using simple chunking:`, error);
      
      return {
        success: false,
        chunks: [],
        error: error instanceof Error ? error.message : 'AST parsing failed'
      };
    }
  }

  private isChunkableNode(node: any, sourceFile: any): boolean {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    
    // Only chunk top-level declarations and meaningful constructs
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isVariableStatement(node) ||
      ts.isExportDeclaration(node) ||
      ts.isImportDeclaration(node) ||
      (ts.isExpressionStatement(node) && node.expression && ts.isCallExpression(node.expression))
    );
  }

  private getNodeName(node: any): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    
    if (node.name && node.name.text) {
      return node.name.text;
    }
    
    if (ts.isVariableStatement(node) && node.declarationList?.declarations?.[0]?.name?.text) {
      return node.declarationList.declarations[0].name.text;
    }
    
    if (ts.isExportDeclaration(node)) {
      return 'export';
    }
    
    if (ts.isImportDeclaration(node)) {
      return 'import';
    }
    
    return 'anonymous';
  }

  private getNodeType(node: any): SemanticChunk['type'] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isTypeAliasDeclaration(node)) return 'type';
    if (ts.isEnumDeclaration(node)) return 'enum';
    if (ts.isVariableStatement(node)) return 'variable';
    if (ts.isExportDeclaration(node)) return 'export';
    if (ts.isImportDeclaration(node)) return 'import';
    
    return 'code';
  }

  private isAsyncNode(node: any): boolean {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    return !!(node.modifiers?.some((mod: any) => mod.kind === ts.SyntaxKind.AsyncKeyword));
  }

  private isExported(node: any): boolean {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    return !!(node.modifiers?.some((mod: any) => mod.kind === ts.SyntaxKind.ExportKeyword));
  }

  private getParameters(node: any): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      return node.parameters?.map((param: any) => param.name?.text || 'unknown') || [];
    }
    
    return [];
  }

  private extractImportsFromNode(sourceFile: any): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    const imports: string[] = [];

    const visit = (node: any) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      
      if (ts.isCallExpression(node) && 
          node.expression.text === 'require' && 
          node.arguments?.[0] && 
          ts.isStringLiteral(node.arguments[0])) {
        imports.push(node.arguments[0].text);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(new Set(imports));
  }

  private extractExportsFromNode(sourceFile: any): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require('typescript');
    const exports: string[] = [];

    const visit = (node: any) => {
      // Named exports
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push(element.name.text);
        }
      }

      // Export declarations (functions, classes, etc.)
      if (this.isExported(node) && node.name?.text) {
        exports.push(node.name.text);
      }

      // Default exports
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        exports.push('default');
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(new Set(exports));
  }

  private getLanguageFromExtension(source?: string): string {
    if (!source) return 'javascript';
    if (source.endsWith('.ts') || source.endsWith('.mts') || source.endsWith('.cts')) return 'typescript';
    if (source.endsWith('.tsx')) return 'tsx';
    if (source.endsWith('.jsx')) return 'jsx';
    return 'javascript';
  }
}