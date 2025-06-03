/**
 * MCP Server Types for PrivMX Documentation
 */

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  type: 'method' | 'class' | 'example' | 'tutorial' | 'troubleshooting';
  namespace: string;
  className?: string;
  methodName?: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  sourceFile: string;
  lineNumber?: number;
  relatedMethods?: string[];
  dependencies?: string[];
  commonMistakes?: string[];
  useCases?: string[];
}

export interface ParsedContent {
  type: 'method' | 'class' | 'type' | 'example';
  name: string;
  description: string;
  content: string;
  metadata: ChunkMetadata;
  examples?: CodeExample[];
  parameters?: Parameter[];
  returns?: ReturnValue[];
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
  title?: string;
}

export interface Parameter {
  name: string;
  description: string;
  type: TypeInfo;
}

export interface ReturnValue {
  type: TypeInfo;
  description: string;
}

export interface TypeInfo {
  name: string;
  optional: boolean;
}

export interface SearchOptions {
  filters?: {
    namespace?: string;
    type?: ChunkMetadata['type'];
    importance?: ChunkMetadata['importance'];
    tags?: string[];
  };
  limit?: number;
  threshold?: number;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  explanation?: string;
}

export interface ChunkingStrategy {
  name: string;
  shouldSplit: (content: ParsedContent) => boolean;
  splitLogic: (content: ParsedContent) => DocumentChunk[];
}

export interface EmbeddingEnhancer {
  enhance: (chunk: DocumentChunk) => Promise<DocumentChunk>;
}

export interface ServerConfig {
  openai: {
    apiKey: string;
    model: string;
    dimensions: number;
  };
  vectorDatabase: {
    type: 'chroma' | 'pinecone' | 'weaviate';
    url: string;
    collection: string;
  };
  chunking: {
    maxChunkSize: number;
    overlapSize: number;
    strategy: string;
  };
  server: {
    name: string;
    version: string;
    port?: number;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  code?: CodeExample;
  prerequisites?: string[];
  nextSteps?: string[];
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  steps: WorkflowStep[];
  tags: string[];
}
