/**
 * Loader Types
 */

export interface DocumentLoader {
  load(path: string): Promise<LoaderResult>;
  supports(extension: string): boolean;
}

export interface LoaderResult {
  success: boolean;
  content?: string;
  metadata?: Record<string, unknown>;
  errors?: string[];
}

export interface ParsedDocument {
  path: string;
  content: string;
  metadata: Record<string, unknown>;
  type: 'api' | 'guide' | 'reference' | 'example';
}

export interface LoaderOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveCodeBlocks?: boolean;
  extractMetadata?: boolean;
  apiTransforms?: {
    expandInheritance?: boolean;
    resolveReferences?: boolean;
    generateExamples?: boolean;
    validateSchema?: boolean;
  };
  languageConfig?: Record<string, unknown>;
}

export interface DocumentMetadata {
  source: string;
  type: 'json-api' | 'mdx' | 'markdown' | 'json';
  namespace?: string;
  className?: string;
  methodName?: string;
  title?: string;
  headers?: string[];
  codeBlocks?: string[];
  lastModified?: Date;
  size?: number;
  [key: string]: unknown;
}
