// Main exports for the parsing system
export { BaseParser, SUPPORTED_LANGUAGES } from './types';
export type { SemanticChunk, ParseResult } from './types';
export { ParserFactory, parserFactory } from './parser-factory';

// Individual parsers
export { JSONParser } from './json-parser';
export { YAMLParser } from './yaml-parser';
export { PythonParser } from './python-parser';
export { GoParser } from './go-parser';
export { DockerfileParser } from './dockerfile-parser';
export { AnsibleParser } from './ansible-parser';
export { TerraformParser } from './terraform-parser';

// Import types for utility functions
import type { ParseResult } from './types';
import { parserFactory } from './parser-factory';

// Utility function for easy parsing
export const parseContent = (content: string, source?: string, language?: string): ParseResult => {
  return parserFactory.parse(content, source, language);
};

// Utility function to detect language
export const detectLanguage = (content: string, source?: string): string | null => {
  const result = parserFactory.parse(content, source);
  return result.chunks[0]?.metadata.language || null;
};
