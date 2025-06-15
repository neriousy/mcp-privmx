import type { Document } from '@langchain/core/documents';

/**
 * EmbeddingProvider – abstraction over LLM embedding back-ends (OpenAI, Ollama, Cohere, etc.)
 */
export interface EmbeddingProvider {
  /** Prepare underlying SDK/credentials */
  initialize(): Promise<void>;

  /** Embed a list of texts; return vectors */
  embedDocuments(
    texts: string[],
    metadata?: Record<string, unknown>[]
  ): Promise<number[][]>;

  /** Embed a single query */
  embedQuery(text: string): Promise<number[]>;

  /** Human-readable name of the model used (eg. "text-embedding-3-small") */
  getModelName(): string;
}
