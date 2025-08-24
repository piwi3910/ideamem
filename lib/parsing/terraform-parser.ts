import { BaseParser, SemanticChunk, ParseResult } from './types';

export class TerraformParser extends BaseParser {
  language = 'terraform';
  fileExtensions = ['.tf', '.tfvars'];

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
          type: 'config',
          name: source ? source.replace(/.*\//, '').replace(/\.tf(vars)?$/, '') : 'terraform-config',
          content,
          startLine: 1,
          endLine: content.split('\n').length,
          metadata: {
            language: this.language,
            dependencies: []
          }
        }],
        success: false,
        error: error instanceof Error ? error.message : 'Terraform parsing failed',
        fallbackUsed: true
      };
    }
  }

  private extractSemanticChunks(content: string, source?: string): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    const lines = content.split('\n');
    
    if (source?.endsWith('.tfvars')) {
      // Parse variable definitions file
      chunks.push(...this.parseTfVars(lines));
    } else {
      // Parse main Terraform configuration
      chunks.push(...this.parseBlocks(lines));
    }

    return chunks;
  }

  private parseBlocks(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (line === '' || line.startsWith('#') || line.startsWith('//')) {
        i++;
        continue;
      }
      
      const block = this.parseBlock(lines, i);
      if (block) {
        chunks.push(this.createChunk(
          this.getBlockType(block.type),
          block.name,
          block.content,
          block.startLine,
          block.endLine,
          {
            dependencies: block.dependencies,
            exports: block.exports
          }
        ));
        i = block.endLine;
      } else {
        i++;
      }
    }
    
    return chunks;
  }

  private parseBlock(lines: string[], startIndex: number): {
    type: string;
    name: string;
    content: string;
    startLine: number;
    endLine: number;
    dependencies: string[];
    exports: string[];
  } | null {
    const line = lines[startIndex].trim();
    
    // Match HCL block patterns
    const blockPatterns = [
      // resource "type" "name" {
      /^(resource)\s+"([^"]+)"\s+"([^"]+)"\s*\{/,
      // data "type" "name" {
      /^(data)\s+"([^"]+)"\s+"([^"]+)"\s*\{/,
      // module "name" {
      /^(module)\s+"([^"]+)"\s*\{/,
      // provider "name" {
      /^(provider)\s+"([^"]+)"\s*\{/,
      // variable "name" {
      /^(variable)\s+"([^"]+)"\s*\{/,
      // output "name" {
      /^(output)\s+"([^"]+)"\s*\{/,
      // locals {
      /^(locals)\s*\{/,
      // terraform {
      /^(terraform)\s*\{/
    ];
    
    for (const pattern of blockPatterns) {
      const match = line.match(pattern);
      if (match) {
        const blockType = match[1];
        const resourceType = match[2]; // For resource/data blocks
        const blockName = match[3] || match[2] || blockType;
        
        const blockEnd = this.findBlockEnd(lines, startIndex);
        const blockContent = lines.slice(startIndex, blockEnd).join('\n');
        
        const fullName = resourceType ? `${resourceType}.${blockName}` : blockName;
        
        return {
          type: blockType,
          name: fullName,
          content: blockContent,
          startLine: startIndex + 1,
          endLine: blockEnd,
          dependencies: this.extractBlockDependencies(blockContent, blockType),
          exports: this.extractBlockExports(blockType, resourceType, blockName)
        };
      }
    }
    
    return null;
  }

  private findBlockEnd(lines: string[], startIndex: number): number {
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

  private extractBlockDependencies(content: string, blockType: string): string[] {
    const dependencies: string[] = [];
    
    // Extract variable references: var.name, local.name, etc.
    const varReferences = content.match(/(?:var|local|data|module)\.[\w.-]+/g);
    if (varReferences) {
      dependencies.push(...varReferences);
    }
    
    // Extract resource references: resource_type.name
    const resourceReferences = content.match(/[\w_]+\.[\w_]+(?=\s*[,\s\]\}])/g);
    if (resourceReferences) {
      dependencies.push(...resourceReferences.filter(ref => 
        !ref.startsWith('var.') && 
        !ref.startsWith('local.') && 
        !ref.startsWith('data.') &&
        !ref.startsWith('module.')
      ));
    }
    
    // Extract provider dependencies for resources
    if (blockType === 'resource') {
      const providerMatch = content.match(/provider\s*=\s*[\w.-]+/);
      if (providerMatch) {
        dependencies.push(providerMatch[0]);
      }
    }
    
    // Extract module source
    if (blockType === 'module') {
      const sourceMatch = content.match(/source\s*=\s*"([^"]+)"/);
      if (sourceMatch) {
        dependencies.push(sourceMatch[1]);
      }
    }
    
    return dependencies;
  }

  private extractBlockExports(blockType: string, resourceType?: string, blockName?: string): string[] {
    const exports: string[] = [];
    
    switch (blockType) {
      case 'resource':
      case 'data':
        if (resourceType && blockName) {
          exports.push(`${resourceType}.${blockName}`);
        }
        break;
      case 'module':
      case 'variable':
      case 'output':
        if (blockName) {
          exports.push(blockName);
        }
        break;
      case 'locals':
        // Would need to parse the content to extract local names
        exports.push('locals');
        break;
    }
    
    return exports;
  }

  private getBlockType(terraformType: string): SemanticChunk['type'] {
    switch (terraformType) {
      case 'resource':
      case 'data':
        return 'resource';
      case 'module':
        return 'module';
      case 'provider':
        return 'config';
      case 'variable':
        return 'variable';
      case 'output':
        return 'variable';
      case 'locals':
        return 'variable';
      case 'terraform':
        return 'config';
      default:
        return 'config';
    }
  }

  private parseTfVars(lines: string[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentVar: {
      name: string;
      value: string;
      startLine: number;
      lines: string[];
    } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        if (currentVar) {
          currentVar.lines.push(line);
        }
        continue;
      }
      
      // Check for variable assignment
      const varMatch = trimmed.match(/^(\w+)\s*=\s*(.*)$/);
      if (varMatch) {
        // Finish previous variable
        if (currentVar) {
          chunks.push(this.createChunk(
            'variable',
            currentVar.name,
            currentVar.lines.join('\n'),
            currentVar.startLine,
            i,
            { exports: [currentVar.name] }
          ));
        }
        
        // Start new variable
        const varName = varMatch[1];
        let varValue = varMatch[2];
        
        currentVar = {
          name: varName,
          value: varValue,
          startLine: i + 1,
          lines: [line]
        };
        
        // Check if it's a multi-line value
        if (this.isMultiLineValue(varValue)) {
          // Continue reading until the value is complete
          continue;
        } else {
          // Single line variable, complete it immediately
          chunks.push(this.createChunk(
            'variable',
            currentVar.name,
            line,
            currentVar.startLine,
            i + 1,
            { exports: [currentVar.name] }
          ));
          currentVar = null;
        }
      } else if (currentVar) {
        // Continue multi-line value
        currentVar.lines.push(line);
        currentVar.value += '\n' + trimmed;
        
        // Check if this completes the multi-line value
        if (this.isValueComplete(currentVar.value)) {
          chunks.push(this.createChunk(
            'variable',
            currentVar.name,
            currentVar.lines.join('\n'),
            currentVar.startLine,
            i + 1,
            { exports: [currentVar.name] }
          ));
          currentVar = null;
        }
      }
    }
    
    // Handle final variable
    if (currentVar) {
      chunks.push(this.createChunk(
        'variable',
        currentVar.name,
        currentVar.lines.join('\n'),
        currentVar.startLine,
        lines.length,
        { exports: [currentVar.name] }
      ));
    }
    
    return chunks;
  }

  private isMultiLineValue(value: string): boolean {
    const trimmedValue = value.trim();
    
    // Check for unmatched brackets/braces/quotes
    const openBrackets = (trimmedValue.match(/\[/g) || []).length;
    const closeBrackets = (trimmedValue.match(/\]/g) || []).length;
    const openBraces = (trimmedValue.match(/\{/g) || []).length;
    const closeBraces = (trimmedValue.match(/\}/g) || []).length;
    const quotes = (trimmedValue.match(/"/g) || []).length;
    
    return openBrackets !== closeBrackets || 
           openBraces !== closeBraces || 
           quotes % 2 !== 0 ||
           trimmedValue.endsWith('\\');
  }

  private isValueComplete(value: string): boolean {
    const trimmedValue = value.trim();
    
    // Check for matched brackets/braces/quotes
    const openBrackets = (trimmedValue.match(/\[/g) || []).length;
    const closeBrackets = (trimmedValue.match(/\]/g) || []).length;
    const openBraces = (trimmedValue.match(/\{/g) || []).length;
    const closeBraces = (trimmedValue.match(/\}/g) || []).length;
    const quotes = (trimmedValue.match(/"/g) || []).length;
    
    return openBrackets === closeBrackets && 
           openBraces === closeBraces && 
           quotes % 2 === 0 &&
           !trimmedValue.endsWith('\\');
  }
}