import { BaseParser, SemanticChunk, ParseResult } from './types';

export class GoParser extends BaseParser {
  language = 'go';
  fileExtensions = ['.go'];

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
          type: 'package',
          name: source ? source.replace(/.*\//, '').replace('.go', '') : 'go-package',
          content,
          startLine: 1,
          endLine: content.split('\n').length,
          metadata: {
            language: this.language,
            dependencies: []
          }
        }],
        success: false,
        error: error instanceof Error ? error.message : 'Go parsing failed',
        fallbackUsed: true
      };
    }
  }

  private extractSemanticChunks(content: string, source?: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = content.split('\n');
    
    // Parse package declaration
    chunks.push(...this.parsePackage(lines));
    
    // Parse imports
    chunks.push(...this.parseImports(lines));
    
    // Parse types (structs, interfaces)
    chunks.push(...this.parseTypes(lines));
    
    // Parse functions
    chunks.push(...this.parseFunctions(lines));
    
    // Parse constants and variables
    chunks.push(...this.parseConstants(lines));
    chunks.push(...this.parseVariables(lines));

    return chunks;
  }

  private parsePackage(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('package ')) {
        const packageMatch = line.match(/^package\s+(\w+)/);
        if (packageMatch) {
          const packageName = packageMatch[1];
          
          chunks.push(this.createChunk(
            'package',
            packageName,
            line,
            i + 1,
            i + 1,
            { exports: [packageName] }
          ));
        }
        break;
      }
    }
    
    return chunks;
  }

  private parseImports(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentImportBlock: string[] = [];
    let blockStart = -1;
    let blockEnd = -1;
    let inImportBlock = false;
    const imports: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === 'import (') {
        inImportBlock = true;
        blockStart = i + 1;
        currentImportBlock = [line];
      } else if (inImportBlock && trimmed === ')') {
        inImportBlock = false;
        blockEnd = i + 1;
        currentImportBlock.push(line);
        
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
      } else if (inImportBlock) {
        currentImportBlock.push(line);
        
        // Extract import path
        const importMatch = trimmed.match(/^(?:(\w+)\s+)?"([^"]+)"/);
        if (importMatch) {
          const importPath = importMatch[2];
          const alias = importMatch[1];
          imports.push(alias || importPath.split('/').pop() || importPath);
        }
      } else if (trimmed.startsWith('import ') && !trimmed.includes('(')) {
        // Single import
        const singleImportMatch = trimmed.match(/^import\s+(?:(\w+)\s+)?"([^"]+)"/);
        if (singleImportMatch) {
          const importPath = singleImportMatch[2];
          const alias = singleImportMatch[1];
          const importName = alias || importPath.split('/').pop() || importPath;
          
          chunks.push(this.createChunk(
            'import',
            importName,
            line,
            i + 1,
            i + 1,
            { dependencies: [importName] }
          ));
        }
      }
    }
    
    return chunks;
  }

  private parseTypes(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Parse struct definitions
      if (trimmed.startsWith('type ') && trimmed.includes('struct')) {
        const structMatch = trimmed.match(/^type\s+(\w+)\s+struct/);
        if (structMatch) {
          const structName = structMatch[1];
          const structStart = i + 1;
          let structEnd = this.findStructEnd(lines, i);
          
          const structContent = lines.slice(i, structEnd).join('\n');
          
          chunks.push(this.createChunk(
            'struct',
            structName,
            structContent,
            structStart,
            structEnd,
            {
              exports: [structName],
              dependencies: this.extractStructDependencies(structContent)
            }
          ));
        }
      }
      // Parse interface definitions
      else if (trimmed.startsWith('type ') && trimmed.includes('interface')) {
        const interfaceMatch = trimmed.match(/^type\s+(\w+)\s+interface/);
        if (interfaceMatch) {
          const interfaceName = interfaceMatch[1];
          const interfaceStart = i + 1;
          let interfaceEnd = this.findInterfaceEnd(lines, i);
          
          const interfaceContent = lines.slice(i, interfaceEnd).join('\n');
          
          chunks.push(this.createChunk(
            'interface',
            interfaceName,
            interfaceContent,
            interfaceStart,
            interfaceEnd,
            { exports: [interfaceName] }
          ));
        }
      }
      // Parse type aliases
      else if (trimmed.startsWith('type ') && !trimmed.includes('struct') && !trimmed.includes('interface')) {
        const typeMatch = trimmed.match(/^type\s+(\w+)\s+(.+)/);
        if (typeMatch) {
          const typeName = typeMatch[1];
          
          chunks.push(this.createChunk(
            'type',
            typeName,
            line,
            i + 1,
            i + 1,
            { exports: [typeName] }
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
      
      if (trimmed.startsWith('func ')) {
        // Parse method (has receiver)
        const methodMatch = trimmed.match(/^func\s+\(([^)]+)\)\s+(\w+)\s*\([^)]*\)/);
        if (methodMatch) {
          const receiver = methodMatch[1];
          const methodName = methodMatch[2];
          const funcStart = i + 1;
          let funcEnd = this.findFunctionEnd(lines, i);
          
          const funcContent = lines.slice(i, funcEnd).join('\n');
          const receiverType = this.extractReceiverType(receiver);
          
          chunks.push(this.createChunk(
            'method',
            methodName,
            funcContent,
            funcStart,
            funcEnd,
            {
              parent: receiverType,
              parameters: this.extractParameters(trimmed),
              exports: [methodName]
            }
          ));
        }
        // Parse regular function
        else {
          const funcMatch = trimmed.match(/^func\s+(\w+)\s*\([^)]*\)/);
          if (funcMatch) {
            const funcName = funcMatch[1];
            const funcStart = i + 1;
            let funcEnd = this.findFunctionEnd(lines, i);
            
            const funcContent = lines.slice(i, funcEnd).join('\n');
            
            chunks.push(this.createChunk(
              'function',
              funcName,
              funcContent,
              funcStart,
              funcEnd,
              {
                parameters: this.extractParameters(trimmed),
                exports: [funcName]
              }
            ));
          }
        }
      }
    }
    
    return chunks;
  }

  private parseConstants(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let inConstBlock = false;
    let constBlock: string[] = [];
    let blockStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === 'const (') {
        inConstBlock = true;
        constBlock = [line];
        blockStart = i + 1;
      } else if (inConstBlock && trimmed === ')') {
        inConstBlock = false;
        constBlock.push(line);
        
        chunks.push(this.createChunk(
          'constant',
          'constants',
          constBlock.join('\n'),
          blockStart,
          i + 1,
          { exports: this.extractConstNames(constBlock) }
        ));
        
        constBlock = [];
      } else if (inConstBlock) {
        constBlock.push(line);
      } else if (trimmed.startsWith('const ') && !trimmed.includes('(')) {
        // Single constant
        const constMatch = trimmed.match(/^const\s+(\w+)/);
        if (constMatch) {
          const constName = constMatch[1];
          
          chunks.push(this.createChunk(
            'constant',
            constName,
            line,
            i + 1,
            i + 1,
            { exports: [constName] }
          ));
        }
      }
    }
    
    return chunks;
  }

  private parseVariables(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let inVarBlock = false;
    let varBlock: string[] = [];
    let blockStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === 'var (') {
        inVarBlock = true;
        varBlock = [line];
        blockStart = i + 1;
      } else if (inVarBlock && trimmed === ')') {
        inVarBlock = false;
        varBlock.push(line);
        
        chunks.push(this.createChunk(
          'variable',
          'variables',
          varBlock.join('\n'),
          blockStart,
          i + 1,
          { exports: this.extractVarNames(varBlock) }
        ));
        
        varBlock = [];
      } else if (inVarBlock) {
        varBlock.push(line);
      } else if (trimmed.startsWith('var ') && !trimmed.includes('(')) {
        // Single variable
        const varMatch = trimmed.match(/^var\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          
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
    
    return chunks;
  }

  private findStructEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }
    
    return lines.length;
  }

  private findInterfaceEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }
    
    return lines.length;
  }

  private findFunctionEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
          if (foundOpenBrace && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }
    
    return lines.length;
  }

  private extractParameters(funcDef: string): string[] {
    const match = funcDef.match(/\(([^)]*)\)/);
    if (!match) return [];
    
    const params = match[1].split(',')
      .map(param => param.trim())
      .filter(param => param && !param.includes('*') && !param.includes('.'))
      .map(param => {
        const parts = param.split(' ');
        return parts.length > 1 ? parts[0] : param;
      });
    
    return params;
  }

  private extractReceiverType(receiver: string): string {
    const match = receiver.match(/\*?(\w+)/);
    return match ? match[1] : 'unknown';
  }

  private extractStructDependencies(structContent: string): string[] {
    const dependencies: string[] = [];
    const lines = structContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for embedded structs or field types
      const fieldMatch = trimmed.match(/^\w+\s+(\*?[\w.]+)/);
      if (fieldMatch) {
        const fieldType = fieldMatch[1].replace(/^\*/, '');
        if (fieldType.includes('.')) {
          // Qualified type (e.g., time.Time)
          dependencies.push(fieldType.split('.')[0]);
        } else if (fieldType[0] === fieldType[0].toUpperCase()) {
          // Likely a custom type
          dependencies.push(fieldType);
        }
      }
    }
    
    return dependencies;
  }

  private extractConstNames(constBlock: string[]): string[] {
    const names: string[] = [];
    
    for (const line of constBlock) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\w+)/);
      if (match && match[1] !== 'const') {
        names.push(match[1]);
      }
    }
    
    return names;
  }

  private extractVarNames(varBlock: string[]): string[] {
    const names: string[] = [];
    
    for (const line of varBlock) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\w+)/);
      if (match && match[1] !== 'var') {
        names.push(match[1]);
      }
    }
    
    return names;
  }
}