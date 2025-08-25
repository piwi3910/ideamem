import { BaseParser, ParseResult, SemanticChunk } from './types';

export class SQLParser extends BaseParser {
  language = 'sql';
  fileExtensions = ['.sql', '.ddl', '.dml'];

  parse(content: string, source?: string): ParseResult {
    try {
      const chunks: SemanticChunk[] = [];
      const lines = content.split('\n');
      
      // Split content by SQL statements (ending with semicolon)
      const statements = this.splitIntoStatements(content);
      
      let currentLine = 1;
      
      for (const statement of statements) {
        if (statement.trim().length === 0) continue;
        
        const statementLines = statement.split('\n').length;
        const statementType = this.getStatementType(statement);
        const statementName = this.getStatementName(statement, statementType);
        
        chunks.push({
          content: statement.trim(),
          type: this.getChunkType(statementType),
          name: statementName,
          startLine: currentLine,
          endLine: currentLine + statementLines - 1,
          metadata: {
            language: 'sql',
            sqlType: statementType,
            dependencies: this.extractTableReferences(statement),
            exports: this.extractDefinedTables(statement, statementType),
            sqlKeywords: this.extractKeywords(statement),
          }
        });
        
        currentLine += statementLines;
      }
      
      // Handle SQL comments as documentation
      this.extractComments(content, chunks);
      
      // If no statements found, create single chunk
      if (chunks.length === 0) {
        chunks.push({
          content: content,
          type: 'config',
          name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'sql-file' : 'sql-file',
          startLine: 1,
          endLine: lines.length,
          metadata: {
            language: 'sql',
            dependencies: [],
            exports: [],
          }
        });
      }

      return {
        success: true,
        chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
        language: 'sql',
        metadata: {
          totalChunks: chunks.length,
          parser: 'sql-semantic',
        }
      };

    } catch (error) {
      console.warn(`SQL parsing failed for ${source || 'unknown'}, using fallback chunking:`, error);
      return this.createFallbackChunks(content, source);
    }
  }

  private splitIntoStatements(content: string): string[] {
    // Split by semicolons, but be careful about semicolons in strings
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }
      
      currentStatement += char;
      
      if (!inString && char === ';') {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Add remaining content if any
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
  }

  private getStatementType(statement: string): string {
    const upperStatement = statement.trim().toUpperCase();
    
    // DDL statements
    if (upperStatement.startsWith('CREATE TABLE')) return 'CREATE_TABLE';
    if (upperStatement.startsWith('CREATE INDEX')) return 'CREATE_INDEX';
    if (upperStatement.startsWith('CREATE VIEW')) return 'CREATE_VIEW';
    if (upperStatement.startsWith('CREATE TRIGGER')) return 'CREATE_TRIGGER';
    if (upperStatement.startsWith('CREATE FUNCTION')) return 'CREATE_FUNCTION';
    if (upperStatement.startsWith('CREATE PROCEDURE')) return 'CREATE_PROCEDURE';
    if (upperStatement.startsWith('ALTER TABLE')) return 'ALTER_TABLE';
    if (upperStatement.startsWith('DROP TABLE')) return 'DROP_TABLE';
    if (upperStatement.startsWith('DROP INDEX')) return 'DROP_INDEX';
    
    // DML statements
    if (upperStatement.startsWith('INSERT')) return 'INSERT';
    if (upperStatement.startsWith('UPDATE')) return 'UPDATE';
    if (upperStatement.startsWith('DELETE')) return 'DELETE';
    if (upperStatement.startsWith('SELECT')) return 'SELECT';
    
    // Prisma-specific
    if (upperStatement.startsWith('PRAGMA')) return 'PRAGMA';
    
    return 'STATEMENT';
  }

  private getStatementName(statement: string, statementType: string): string {
    const upperStatement = statement.trim().toUpperCase();
    
    switch (statementType) {
      case 'CREATE_TABLE':
        const tableMatch = upperStatement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/);
        return tableMatch ? tableMatch[1] : 'table';
        
      case 'ALTER_TABLE':
        const alterMatch = upperStatement.match(/ALTER TABLE\s+["'`]?(\w+)["'`]?/);
        return alterMatch ? `alter_${alterMatch[1]}` : 'alter_table';
        
      case 'CREATE_INDEX':
        const indexMatch = upperStatement.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/);
        return indexMatch ? indexMatch[1] : 'index';
        
      case 'INSERT':
        const insertMatch = upperStatement.match(/INSERT INTO\s+["'`]?(\w+)["'`]?/);
        return insertMatch ? `insert_${insertMatch[1]}` : 'insert';
        
      case 'SELECT':
        const selectMatch = upperStatement.match(/FROM\s+["'`]?(\w+)["'`]?/);
        return selectMatch ? `select_${selectMatch[1]}` : 'select';
        
      case 'PRAGMA':
        const pragmaMatch = upperStatement.match(/PRAGMA\s+(\w+)/);
        return pragmaMatch ? `pragma_${pragmaMatch[1]}` : 'pragma';
        
      default:
        return statementType.toLowerCase();
    }
  }

  private getChunkType(statementType: string): SemanticChunk['type'] {
    switch (statementType) {
      case 'CREATE_TABLE':
      case 'CREATE_VIEW':
        return 'struct';
      case 'CREATE_FUNCTION':
      case 'CREATE_PROCEDURE':
      case 'CREATE_TRIGGER':
        return 'function';
      case 'CREATE_INDEX':
        return 'config';
      case 'ALTER_TABLE':
      case 'DROP_TABLE':
      case 'DROP_INDEX':
        return 'config';
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
      case 'SELECT':
        return 'code';
      case 'PRAGMA':
        return 'config';
      default:
        return 'code';
    }
  }

  private extractTableReferences(statement: string): string[] {
    const tables: string[] = [];
    const upperStatement = statement.toUpperCase();
    
    // Extract FROM clauses
    const fromMatches = statement.match(/FROM\s+["'`]?(\w+)["'`]?/gi);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const tableMatch = match.match(/FROM\s+["'`]?(\w+)["'`]?/i);
        if (tableMatch) tables.push(tableMatch[1]);
      });
    }
    
    // Extract JOIN clauses
    const joinMatches = statement.match(/JOIN\s+["'`]?(\w+)["'`]?/gi);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableMatch = match.match(/JOIN\s+["'`]?(\w+)["'`]?/i);
        if (tableMatch) tables.push(tableMatch[1]);
      });
    }
    
    // Extract UPDATE/INSERT/DELETE target tables
    const targetMatches = statement.match(/(?:UPDATE|INSERT INTO|DELETE FROM)\s+["'`]?(\w+)["'`]?/gi);
    if (targetMatches) {
      targetMatches.forEach(match => {
        const tableMatch = match.match(/(?:UPDATE|INSERT INTO|DELETE FROM)\s+["'`]?(\w+)["'`]?/i);
        if (tableMatch) tables.push(tableMatch[1]);
      });
    }
    
    return Array.from(new Set(tables));
  }

  private extractDefinedTables(statement: string, statementType: string): string[] {
    const tables: string[] = [];
    
    if (statementType === 'CREATE_TABLE') {
      const match = statement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/i);
      if (match) tables.push(match[1]);
    }
    
    if (statementType === 'CREATE_VIEW') {
      const match = statement.match(/CREATE VIEW\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/i);
      if (match) tables.push(match[1]);
    }
    
    return tables;
  }

  private extractKeywords(statement: string): string[] {
    const keywords = statement.toUpperCase().match(/\b(CREATE|TABLE|INDEX|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT|PRAGMA)\b/g);
    return keywords ? Array.from(new Set(keywords)) : [];
  }

  private extractComments(content: string, chunks: SemanticChunk[]): void {
    const lines = content.split('\n');
    let currentComment = '';
    let commentStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('--') || line.startsWith('/*')) {
        if (!currentComment) {
          commentStartLine = i + 1;
        }
        currentComment += line + '\n';
        
        // Handle block comments ending
        if (line.includes('*/')) {
          chunks.push({
            content: currentComment.trim(),
            type: 'text',
            name: 'comment',
            startLine: commentStartLine,
            endLine: i + 1,
            metadata: {
              language: 'sql',
              dependencies: [],
              exports: [],
            }
          });
          currentComment = '';
        }
      } else if (line.startsWith('--')) {
        // Single line comment
        chunks.push({
          content: line,
          type: 'text',
          name: 'comment',
          startLine: i + 1,
          endLine: i + 1,
          metadata: {
            language: 'sql',
            dependencies: [],
            exports: [],
          }
        });
      } else if (currentComment && !line.includes('*/')) {
        // Continue multi-line comment
        currentComment += line + '\n';
      } else if (currentComment) {
        // End of multi-line comment without explicit closing
        chunks.push({
          content: currentComment.trim(),
          type: 'text',
          name: 'comment',
          startLine: commentStartLine,
          endLine: i,
          metadata: {
            language: 'sql',
            dependencies: [],
            exports: [],
          }
        });
        currentComment = '';
      }
    }
  }

  private createFallbackChunks(content: string, source?: string): ParseResult {
    const lines = content.split('\n');
    const chunks: SemanticChunk[] = [];
    
    // Simple fallback - split by empty lines or semicolons
    const sections = content.split(/;\s*\n\s*\n|\n\s*\n/).filter(section => section.trim());
    
    if (sections.length > 1) {
      let currentLine = 1;
      for (const section of sections) {
        const sectionLines = section.split('\n').length;
        chunks.push({
          content: section.trim(),
          type: 'code',
          name: 'sql-statement',
          startLine: currentLine,
          endLine: currentLine + sectionLines - 1,
          metadata: {
            language: 'sql',
            dependencies: [],
            exports: [],
          }
        });
        currentLine += sectionLines + 1;
      }
    } else {
      chunks.push({
        content: content,
        type: 'config',
        name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'sql-file' : 'sql-file',
        startLine: 1,
        endLine: lines.length,
        metadata: {
          language: 'sql',
          dependencies: [],
          exports: [],
        }
      });
    }

    return {
      success: false,
      chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
      error: 'SQL parsing failed, used fallback',
      fallbackUsed: true,
    };
  }
}