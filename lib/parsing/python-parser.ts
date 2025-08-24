import { BaseParser, SemanticChunk, ParseResult } from './types';

export class PythonParser extends BaseParser {
  language = 'python';
  fileExtensions = ['.py'];

  parse(content: string, source?: string): ParseResult {
    try {
      const chunks = this.extractSemanticChunks(content, source);
      
      return {
        chunks,
        success: true
      };
    } catch (error) {
      return {
        chunks: [{
          type: 'module',
          name: source ? source.replace(/.*\//, '').replace('.py', '') : 'python-module',
          content,
          startLine: 1,
          endLine: content.split('\n').length,
          metadata: {
            language: this.language,
            dependencies: []
          }
        }],
        success: false,
        error: error instanceof Error ? error.message : 'Python parsing failed',
        fallbackUsed: true
      };
    }
  }

  private extractSemanticChunks(content: string, source?: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = content.split('\n');
    
    // Parse imports
    chunks.push(...this.parseImports(lines));
    
    // Parse classes
    chunks.push(...this.parseClasses(lines));
    
    // Parse functions (not inside classes)
    chunks.push(...this.parseFunctions(lines));
    
    // Parse module-level variables and constants
    chunks.push(...this.parseModuleVariables(lines));
    
    // Parse decorators
    chunks.push(...this.parseDecorators(lines));

    return chunks;
  }

  private parseImports(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const imports: string[] = [];
    let currentImportBlock: string[] = [];
    let blockStart = -1;
    let blockEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('import ') || line.startsWith('from ')) {
        if (currentImportBlock.length === 0) {
          blockStart = i + 1;
        }
        currentImportBlock.push(lines[i]);
        blockEnd = i + 1;
        
        // Extract import names
        if (line.startsWith('import ')) {
          const importNames = line.substring(7).split(',').map(name => name.trim().split(' as ')[0]);
          imports.push(...importNames);
        } else if (line.startsWith('from ')) {
          const match = line.match(/from\s+(\S+)\s+import\s+(.+)/);
          if (match) {
            const module = match[1];
            const importedItems = match[2].split(',').map(item => item.trim().split(' as ')[0]);
            imports.push(...importedItems);
          }
        }
      } else if (line === '' && currentImportBlock.length > 0) {
        // Empty line continues the import block
        continue;
      } else if (currentImportBlock.length > 0) {
        // Non-import line ends the import block
        chunks.push(this.createChunk(
          'import',
          'imports',
          currentImportBlock.join('\n'),
          blockStart,
          blockEnd,
          { dependencies: imports.slice() }
        ));
        currentImportBlock = [];
        imports.length = 0;
      }
    }

    // Handle final import block
    if (currentImportBlock.length > 0) {
      chunks.push(this.createChunk(
        'import',
        'imports',
        currentImportBlock.join('\n'),
        blockStart,
        blockEnd,
        { dependencies: imports }
      ));
    }

    return chunks;
  }

  private parseClasses(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('class ')) {
        const classMatch = trimmed.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
        if (classMatch) {
          const className = classMatch[1];
          const classStart = i + 1;
          let classEnd = this.findClassEnd(lines, i);
          
          const classContent = lines.slice(i, classEnd).join('\n');
          
          chunks.push(this.createChunk(
            'class',
            className,
            classContent,
            classStart,
            classEnd,
            {
              exports: [className],
              dependencies: this.extractClassDependencies(classContent)
            }
          ));

          // Parse methods within the class
          chunks.push(...this.parseMethodsInClass(lines, i, classEnd, className));
        }
      }
    }
    
    return chunks;
  }

  private parseMethodsInClass(lines: string[], classStart: number, classEnd: number, className: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = classStart + 1; i < classEnd; i++) {
      const line = lines[i];
      const indentation = line.length - line.trimStart().length;
      const trimmed = line.trim();
      
      if (trimmed.startsWith('def ') && indentation > 0) {
        const methodMatch = trimmed.match(/^def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const methodStart = i + 1;
          let methodEnd = this.findMethodEnd(lines, i, indentation);
          
          const methodContent = lines.slice(i, methodEnd).join('\n');
          const isAsync = line.includes('async def');
          const isStatic = this.hasDecorator(lines, i, '@staticmethod');
          const isClassMethod = this.hasDecorator(lines, i, '@classmethod');
          
          let visibility: 'public' | 'private' | 'protected' = 'public';
          if (methodName.startsWith('__') && methodName.endsWith('__')) {
            visibility = 'public'; // Magic methods are public
          } else if (methodName.startsWith('__')) {
            visibility = 'private';
          } else if (methodName.startsWith('_')) {
            visibility = 'protected';
          }

          chunks.push(this.createChunk(
            'method',
            methodName,
            methodContent,
            methodStart,
            methodEnd,
            {
              parent: className,
              visibility,
              async: isAsync,
              static: isStatic || isClassMethod,
              parameters: this.extractParameters(trimmed),
              decorators: this.extractMethodDecorators(lines, i)
            }
          ));
        }
      }
    }
    
    return chunks;
  }

  private parseFunctions(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indentation = line.length - line.trimStart().length;
      
      // Only parse top-level functions (indentation 0)
      if (trimmed.startsWith('def ') && indentation === 0) {
        const funcMatch = trimmed.match(/^def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const funcStart = i + 1;
          let funcEnd = this.findFunctionEnd(lines, i);
          
          const funcContent = lines.slice(i, funcEnd).join('\n');
          const isAsync = line.includes('async def');

          chunks.push(this.createChunk(
            'function',
            funcName,
            funcContent,
            funcStart,
            funcEnd,
            {
              async: isAsync,
              parameters: this.extractParameters(trimmed),
              decorators: this.extractFunctionDecorators(lines, i),
              exports: [funcName]
            }
          ));
        }
      }
    }
    
    return chunks;
  }

  private parseModuleVariables(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const variables: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indentation = line.length - line.trimStart().length;
      
      // Only parse module-level assignments (indentation 0)
      if (indentation === 0 && !trimmed.startsWith('#') && trimmed.includes('=') && 
          !trimmed.startsWith('def ') && !trimmed.startsWith('class ') && 
          !trimmed.startsWith('import ') && !trimmed.startsWith('from ')) {
        
        const assignmentMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
        if (assignmentMatch) {
          const varName = assignmentMatch[1];
          variables.push(varName);
          
          chunks.push(this.createChunk(
            'constant',
            varName,
            line,
            i + 1,
            i + 1,
            { exports: [varName] }
          ));
        } else {
          const varMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
          if (varMatch) {
            const varName = varMatch[1];
            variables.push(varName);
            
            chunks.push(this.createChunk(
              'variable',
              varName,
              line,
              i + 1,
              i + 1,
              { exports: [varName] }
            ));
          }
        }
      }
    }
    
    return chunks;
  }

  private parseDecorators(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('@') && !trimmed.includes('staticmethod') && 
          !trimmed.includes('classmethod') && !trimmed.includes('property')) {
        const decoratorMatch = trimmed.match(/^@(\w+)/);
        if (decoratorMatch) {
          const decoratorName = decoratorMatch[1];
          
          chunks.push(this.createChunk(
            'function',
            `decorator-${decoratorName}`,
            line,
            i + 1,
            i + 1,
            { exports: [decoratorName] }
          ));
        }
      }
    }
    
    return chunks;
  }

  private findClassEnd(lines: string[], startIndex: number): number {
    const startIndentation = lines[startIndex].length - lines[startIndex].trimStart().length;
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === '') continue; // Skip empty lines
      
      const indentation = line.length - line.trimStart().length;
      if (indentation <= startIndentation) {
        return i;
      }
    }
    
    return lines.length;
  }

  private findMethodEnd(lines: string[], startIndex: number, baseIndentation: number): number {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === '') continue; // Skip empty lines
      
      const indentation = line.length - line.trimStart().length;
      if (indentation <= baseIndentation) {
        return i;
      }
    }
    
    return lines.length;
  }

  private findFunctionEnd(lines: string[], startIndex: number): number {
    const startIndentation = lines[startIndex].length - lines[startIndex].trimStart().length;
    
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === '') continue; // Skip empty lines
      
      const indentation = line.length - line.trimStart().length;
      if (indentation <= startIndentation) {
        return i;
      }
    }
    
    return lines.length;
  }

  private extractParameters(funcDef: string): string[] {
    const match = funcDef.match(/\(([^)]*)\)/);
    if (!match) return [];
    
    const params = match[1].split(',')
      .map(param => param.trim())
      .filter(param => param && param !== 'self' && param !== 'cls')
      .map(param => param.split('=')[0].trim()) // Remove default values
      .map(param => param.split(':')[0].trim()); // Remove type annotations
    
    return params;
  }

  private hasDecorator(lines: string[], funcIndex: number, decorator: string): boolean {
    for (let i = funcIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (line.startsWith('@') && line.includes(decorator)) {
        return true;
      }
      if (!line.startsWith('@')) break;
    }
    return false;
  }

  private extractMethodDecorators(lines: string[], methodIndex: number): string[] {
    const decorators: string[] = [];
    
    for (let i = methodIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (line.startsWith('@')) {
        const match = line.match(/^@(\w+)/);
        if (match) {
          decorators.unshift(match[1]);
        }
      } else {
        break;
      }
    }
    
    return decorators;
  }

  private extractFunctionDecorators(lines: string[], funcIndex: number): string[] {
    const decorators: string[] = [];
    
    for (let i = funcIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (line.startsWith('@')) {
        const match = line.match(/^@(\w+)/);
        if (match) {
          decorators.unshift(match[1]);
        }
      } else {
        break;
      }
    }
    
    return decorators;
  }

  private extractClassDependencies(classContent: string): string[] {
    const dependencies: string[] = [];
    const lines = classContent.split('\n');
    
    // Look for inheritance
    const classLine = lines[0];
    const inheritanceMatch = classLine.match(/class\s+\w+\(([^)]+)\)/);
    if (inheritanceMatch) {
      const parents = inheritanceMatch[1].split(',').map(p => p.trim());
      dependencies.push(...parents);
    }
    
    return dependencies;
  }
}