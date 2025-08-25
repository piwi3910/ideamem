import { BaseParser, ParseResult, SemanticChunk } from './types';

export class TOMLParser extends BaseParser {
  language = 'toml';
  fileExtensions = ['.toml'];

  parse(content: string, source?: string): ParseResult {
    try {
      const chunks: SemanticChunk[] = [];
      const lines = content.split('\n');
      
      // Parse TOML structure
      let currentSection = '';
      let currentSectionStartLine = 1;
      let currentSectionContent: string[] = [];
      let currentLine = 0;
      
      for (let i = 0; i < lines.length; i++) {
        currentLine = i + 1;
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments at the start
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          if (currentSectionContent.length === 0) {
            // Handle comments as separate chunks
            if (trimmedLine.startsWith('#')) {
              chunks.push({
                content: line,
                type: 'text',
                name: 'comment',
                startLine: currentLine,
                endLine: currentLine,
                metadata: {
                  language: 'toml',
                  dependencies: [],
                  exports: [],
                }
              });
            }
            continue;
          } else {
            currentSectionContent.push(line);
          }
          continue;
        }
        
        // Check for section headers [section] or [[array.section]]
        if (trimmedLine.startsWith('[')) {
          // Save previous section if exists
          if (currentSection && currentSectionContent.length > 0) {
            const sectionChunk = this.createSectionChunk(
              currentSection,
              currentSectionContent.join('\n'),
              currentSectionStartLine,
              i
            );
            chunks.push(sectionChunk);
          }
          
          // Start new section
          currentSection = this.extractSectionName(trimmedLine);
          currentSectionStartLine = currentLine;
          currentSectionContent = [line];
        } else {
          // Add to current section (or root if no section)
          if (!currentSection) {
            // Root level key-value pairs
            const kvChunk = this.parseKeyValue(line, currentLine);
            if (kvChunk) {
              chunks.push(kvChunk);
            }
          } else {
            currentSectionContent.push(line);
          }
        }
      }
      
      // Handle the last section
      if (currentSection && currentSectionContent.length > 0) {
        const sectionChunk = this.createSectionChunk(
          currentSection,
          currentSectionContent.join('\n'),
          currentSectionStartLine,
          lines.length
        );
        chunks.push(sectionChunk);
      }
      
      // If no structured content found, create single chunk
      if (chunks.length === 0) {
        chunks.push({
          content: content,
          type: 'config',
          name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'toml-file' : 'toml-file',
          startLine: 1,
          endLine: lines.length,
          metadata: {
            language: 'toml',
            dependencies: [],
            exports: [],
          }
        });
      }

      return {
        success: true,
        chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
        language: 'toml',
        metadata: {
          totalChunks: chunks.length,
          parser: 'toml-semantic',
        }
      };

    } catch (error) {
      console.warn(`TOML parsing failed for ${source || 'unknown'}, using fallback chunking:`, error);
      return this.createFallbackChunks(content, source);
    }
  }

  private extractSectionName(line: string): string {
    // Extract section name from [section] or [[section.array]]
    const match = line.match(/\[+([^\]]+)\]+/);
    return match ? match[1] : 'section';
  }

  private createSectionChunk(
    sectionName: string,
    content: string,
    startLine: number,
    endLine: number
  ): SemanticChunk {
    const isArray = content.includes('[[');
    const keyValues = this.extractKeyValues(content);
    
    return {
      content: content,
      type: isArray ? 'array_section' : 'config',
      name: sectionName,
      startLine,
      endLine,
      metadata: {
        language: 'toml',
        tomlSection: sectionName,
        isArrayTable: isArray,
        keys: keyValues.map(kv => kv.key),
        dependencies: this.extractDependencies(content),
        exports: [sectionName],
      }
    };
  }

  private parseKeyValue(line: string, lineNumber: number): SemanticChunk | null {
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return null;
    }
    
    // Parse key-value pairs
    const kvMatch = trimmedLine.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (!kvMatch) {
      return null;
    }
    
    const key = kvMatch[1].trim();
    const value = kvMatch[2].trim();
    
    return {
      content: line,
      type: 'variable',
      name: key,
      startLine: lineNumber,
      endLine: lineNumber,
      metadata: {
        language: 'toml',
        tomlKey: key,
        tomlValue: value,
        valueType: this.getValueType(value),
        dependencies: [],
        exports: [key],
      }
    };
  }

  private extractKeyValues(content: string): Array<{ key: string; value: string }> {
    const keyValues: Array<{ key: string; value: string }> = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || trimmedLine.startsWith('[') || !trimmedLine) {
        continue;
      }
      
      const kvMatch = trimmedLine.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (kvMatch) {
        keyValues.push({
          key: kvMatch[1].trim(),
          value: kvMatch[2].trim()
        });
      }
    }
    
    return keyValues;
  }

  private getValueType(value: string): string {
    const trimmedValue = value.trim();
    
    // Check for different TOML value types
    if (trimmedValue === 'true' || trimmedValue === 'false') {
      return 'boolean';
    }
    
    if (trimmedValue.match(/^\d+$/)) {
      return 'integer';
    }
    
    if (trimmedValue.match(/^\d+\.\d+$/)) {
      return 'float';
    }
    
    if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
      return 'string';
    }
    
    if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
      return 'literal_string';
    }
    
    if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
      return 'array';
    }
    
    if (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) {
      return 'inline_table';
    }
    
    // Date/time patterns
    if (trimmedValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'datetime';
    }
    
    return 'unknown';
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Look for file paths or references in string values
    const stringMatches = content.match(/"([^"]*\.(toml|lock|txt|json|yaml|yml))"/g);
    if (stringMatches) {
      stringMatches.forEach(match => {
        const filePath = match.replace(/"/g, '');
        if (!filePath.startsWith('http') && !filePath.startsWith('/')) {
          dependencies.push(filePath);
        }
      });
    }
    
    // Look for URLs
    const urlMatches = content.match(/"(https?:\/\/[^"]+)"/g);
    if (urlMatches) {
      urlMatches.forEach(match => {
        dependencies.push(match.replace(/"/g, ''));
      });
    }
    
    return Array.from(new Set(dependencies));
  }

  private createFallbackChunks(content: string, source?: string): ParseResult {
    const lines = content.split('\n');
    const chunks: SemanticChunk[] = [];
    
    // Simple fallback - split by sections or create single chunk
    const sections = content.split(/\n\s*\[/).filter(section => section.trim());
    
    if (sections.length > 1) {
      let currentLine = 1;
      for (let i = 0; i < sections.length; i++) {
        let section = sections[i];
        if (i > 0) section = '[' + section; // Re-add the [ that was split on
        
        const sectionLines = section.split('\n').length;
        const sectionName = i === 0 ? 'root' : this.extractSectionName(section);
        
        chunks.push({
          content: section.trim(),
          type: 'config',
          name: sectionName,
          startLine: currentLine,
          endLine: currentLine + sectionLines - 1,
          metadata: {
            language: 'toml',
            dependencies: [],
            exports: [],
          }
        });
        currentLine += sectionLines;
      }
    } else {
      chunks.push({
        content: content,
        type: 'config',
        name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'toml-file' : 'toml-file',
        startLine: 1,
        endLine: lines.length,
        metadata: {
          language: 'toml',
          dependencies: [],
          exports: [],
        }
      });
    }

    return {
      success: false,
      chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
      error: 'TOML parsing failed, used fallback',
      fallbackUsed: true,
    };
  }
}