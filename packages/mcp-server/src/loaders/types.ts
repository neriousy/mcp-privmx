export interface LoaderOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveCodeBlocks?: boolean;
  extractMetadata?: boolean;
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
  [key: string]: any;
}
