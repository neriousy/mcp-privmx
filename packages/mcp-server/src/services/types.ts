/**
 * Shared types and interfaces for the API Knowledge Service
 */

export interface SearchResult {
  id: string;
  content: string;
  metadata: {
    type: string;
    namespace?: string;
    title?: string;
    path?: string;
    language?: string;
    methodType?: string;
    className?: string;
  };
  score?: number;
}

export interface CodeGenerationOptions {
  language: string;
  features?: string[];
  className?: string;
  methodName?: string;
  includeImports?: boolean;
  includeErrorHandling?: boolean;
}

export interface APIKnowledgeServiceConfig {
  specPath: string;
  supportedLanguages: string[];
}

export interface DocumentationStats {
  total: number;
  byType: Record<string, number>;
}

export interface IndexingResult {
  indexed: number;
  updated: number;
  errors: number;
}
