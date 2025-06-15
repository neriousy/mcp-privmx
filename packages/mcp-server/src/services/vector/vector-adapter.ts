import type {
  ParsedMDXDocument,
  DocumentationSearchFilters,
  VectorSearchResult,
} from '../../types/documentation-types.js';

/**
 * VectorStoreAdapter – abstraction over vector DB/embedding backends
 * Allows the core services to remain agnostic of the underlying store (Qdrant, Pinecone, FAISS, etc.)
 */
export interface VectorStoreAdapter {
  /** Initialise connection / embeddings provider */
  initialize(): Promise<void>;

  /**
   * Index a batch of processed MDX documents (upsert semantics).
   * Implementations should handle chunking & batching internally.
   */
  indexDocuments(documents: ParsedMDXDocument[]): Promise<void>;

  /**
   * Perform a semantic similarity search.
   * Implementations may fall back to keyword/BM25 if embeddings unavailable.
   */
  semanticSearch(
    query: string,
    filters?: DocumentationSearchFilters,
    limit?: number
  ): Promise<VectorSearchResult[]>;

  /** Find documents similar to an existing document */
  findSimilarDocuments(
    documentId: string,
    limit?: number
  ): Promise<VectorSearchResult[]>;

  /** Optional: permanently remove all vectors / start fresh */
  clearCollection?(): Promise<void>;

  /** Diagnostics */
  getStats(): Promise<{ totalVectors: number; isAvailable: boolean }>;
}
