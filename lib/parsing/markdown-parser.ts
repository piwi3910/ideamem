import { BaseParser, ParseResult, SemanticChunk } from './types';

export class MarkdownParser extends BaseParser {
  language = 'markdown';
  fileExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mdx'];

  parse(content: string, source?: string): ParseResult {
    try {
      const chunks: SemanticChunk[] = [];
      const lines = content.split('\n');
      
      let currentChunk: string[] = [];
      let startLine = 1;
      let currentHeading = '';
      let headingLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Detect headings
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        
        if (headingMatch) {
          const newHeadingLevel = headingMatch[1].length;
          const newHeading = headingMatch[2].trim();

          // Save previous section if it exists
          if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join('\n');
            chunks.push({
              content: chunkContent,
              type: this.getChunkType(chunkContent),
              name: currentHeading || 'introduction',
              startLine,
              endLine: i,
              metadata: {
                language: 'markdown',
                headingLevel,
                dependencies: this.extractLinks(chunkContent),
                exports: [],
              }
            });
          }

          // Start new section
          currentChunk = [line];
          startLine = i + 1;
          currentHeading = newHeading;
          headingLevel = newHeadingLevel;
        } else {
          currentChunk.push(line);
        }

        // Also create chunks for code blocks
        if (trimmedLine.startsWith('```')) {
          const language = trimmedLine.substring(3).trim();
          if (language && currentChunk.length === 1) {
            // This is the start of a code block
            let codeBlockEnd = i + 1;
            const codeLines = [line];
            
            // Find the end of the code block
            while (codeBlockEnd < lines.length && !lines[codeBlockEnd].trim().startsWith('```')) {
              codeLines.push(lines[codeBlockEnd]);
              codeBlockEnd++;
            }
            
            if (codeBlockEnd < lines.length) {
              codeLines.push(lines[codeBlockEnd]); // Add closing ```
            }

            chunks.push({
              content: codeLines.join('\n'),
              type: 'code-block',
              name: `${language}-code-block`,
              startLine: i + 1,
              endLine: codeBlockEnd + 1,
              metadata: {
                language: language || 'unknown',
                codeLanguage: language,
                dependencies: [],
                exports: [],
              }
            });

            // Skip past the code block
            i = codeBlockEnd;
            currentChunk = [];
          }
        }
      }

      // Add remaining content
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        chunks.push({
          content: chunkContent,
          type: this.getChunkType(chunkContent),
          name: currentHeading || 'content',
          startLine,
          endLine: lines.length,
          metadata: {
            language: 'markdown',
            headingLevel,
            dependencies: this.extractLinks(chunkContent),
            exports: [],
          }
        });
      }

      // If no chunks found, create one for the entire content
      if (chunks.length === 0) {
        chunks.push({
          content: content,
          type: 'document',
          name: source ? source.split('/').pop()?.replace(/\.[^.]+$/, '') || 'unknown' : 'unknown',
          startLine: 1,
          endLine: lines.length,
          metadata: {
            language: 'markdown',
            dependencies: this.extractLinks(content),
            exports: [],
          }
        });
      }

      return {
        success: true,
        chunks: chunks.filter(chunk => chunk.content.trim().length > 0),
        language: 'markdown',
        metadata: {
          totalChunks: chunks.length,
          parser: 'markdown',
        }
      };

    } catch (error) {
      return {
        success: false,
        chunks: [],
        error: error instanceof Error ? error.message : 'Markdown parsing error'
      };
    }
  }

  private getChunkType(content: string): SemanticChunk['type'] {
    const trimmed = content.trim();
    
    if (trimmed.startsWith('```')) return 'code-block';
    if (trimmed.startsWith('#')) return 'heading';
    if (trimmed.includes('|') && trimmed.includes('---')) return 'table';
    if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.match(/^\d+\./)) return 'list';
    if (trimmed.startsWith('>')) return 'quote';
    if (trimmed.includes('![')) return 'image';
    if (trimmed.includes('[') && trimmed.includes('](')) return 'link';
    
    return 'text';
  }

  private extractLinks(content: string): string[] {
    const links: string[] = [];
    
    // Extract markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }
    
    // Extract reference-style links [text]: url
    const refLinkRegex = /^\[([^\]]+)\]:\s*(.+)$/gm;
    while ((match = refLinkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }
    
    // Extract image links ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRegex.exec(content)) !== null) {
      links.push(match[2]);
    }
    
    return Array.from(new Set(links)); // Remove duplicates
  }
}