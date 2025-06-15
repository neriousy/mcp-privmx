import type {
  ParsedMDXDocument,
  DocumentationSearchFilters,
  VectorSearchResult,
} from '../../types/documentation-types.js';
import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import { QdrantClient } from '@qdrant/js-client-rest';
import { VectorStoreAdapter } from './vector-adapter.js';
import { EmbeddingProvider } from './embedding-provider.js';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider.js';

/**
 * Minimal config for Qdrant adapter
 */
export interface QdrantAdapterConfig {
  url?: string;
  apiKey?: string;
  collectionName?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
}

export class QdrantVectorAdapter implements VectorStoreAdapter {
  private vectorStore: QdrantVectorStore | null = null;
  private qdrantClient: QdrantClient;
  private embeddings: EmbeddingProvider;
  private config: Required<QdrantAdapterConfig>;
  private initialized = false;

  constructor(config: QdrantAdapterConfig = {}) {
    this.config = {
      url: config.url || process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: config.apiKey || process.env.QDRANT_API_KEY || undefined,
      collectionName:
        config.collectionName ||
        process.env.QDRANT_COLLECTION_NAME ||
        'privmx-docs',
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
    } as Required<QdrantAdapterConfig>;

    // default embedding provider
    this.embeddings = new OpenAIEmbeddingProvider({
      apiKey: this.config.openaiApiKey,
      model: this.config.embeddingModel,
    });

    // Initialize Qdrant client for direct API access
    this.qdrantClient = new QdrantClient({
      url: this.config.url,
      apiKey: this.config.apiKey,
    });
  }

  async initialize(): Promise<void> {
    await this.embeddings.initialize();

    this.vectorStore = new QdrantVectorStore(this.embeddings as any, {
      url: this.config.url,
      apiKey: this.config.apiKey,
      collectionName: this.config.collectionName,
    });

    this.initialized = true;
  }

  private ensureReady() {
    if (!this.initialized || !this.vectorStore) {
      throw new Error('QdrantVectorAdapter not initialized');
    }
  }

  async indexDocuments(documents: ParsedMDXDocument[]): Promise<void> {
    this.ensureReady();

    const langchainDocs: Document[] = documents.map(
      (doc) =>
        new Document({
          pageContent: `${doc.metadata.title}\n\n${doc.rawContent}`,
          metadata: {
            id: doc.id,
            title: doc.metadata.title,
            language: doc.metadata.language,
            namespace: doc.metadata.namespace,
            category: doc.metadata.category,
            type: 'document',
          },
        })
    );

    await (this.vectorStore as QdrantVectorStore).addDocuments(langchainDocs);
  }

  async semanticSearch(
    query: string,
    _filters?: DocumentationSearchFilters,
    limit = 5
  ): Promise<VectorSearchResult[]> {
    this.ensureReady();

    const results = await (
      this.vectorStore as QdrantVectorStore
    ).similaritySearchWithScore(query, limit);

    return results.map(([doc, score]) => ({
      documentId: doc.metadata.id as string,
      title: doc.metadata.title as string,
      content: doc.pageContent,
      metadata: doc.metadata,
      score: 1 - score, // Convert distance to similarity (higher = better match)
      type: doc.metadata.type as 'document' | 'code',
    }));
  }

  async findSimilarDocuments(
    documentId: string,
    limit = 5
  ): Promise<VectorSearchResult[]> {
    /*
     * Qdrant SDK does not expose a direct "find by id and then match" helper in langchain wrapper.
     * As a fallback we reuse the id string as query text – not ideal but prevents runtime errors.
     * TODO: implement using raw Qdrant client once strongly typed.
     */
    return this.semanticSearch(documentId, undefined, limit);
  }

  async getStats(): Promise<{ totalVectors: number; isAvailable: boolean }> {
    if (!this.initialized) {
      return { totalVectors: 0, isAvailable: false };
    }

    try {
      const info = await this.qdrantClient.getCollection(
        this.config.collectionName
      );

      return {
        totalVectors: info.vectors_count || 0,
        isAvailable: true,
      };
    } catch (error) {
      console.warn('Failed to get Qdrant collection stats:', error);
      return { totalVectors: 0, isAvailable: false };
    }
  }

  async clearCollection(): Promise<void> {
    // Remove entire collection from Qdrant – useful for re-indexing
    const endpoint = `${this.config.url}/collections/${this.config.collectionName}`;

    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: this.config.apiKey
          ? { 'api-key': this.config.apiKey }
          : undefined,
      });

      if (!res.ok) {
        console.warn(
          `Failed to delete Qdrant collection (${res.status}): ${await res.text()}`
        );
      } else {
        console.log(
          `🗑️  Cleared Qdrant collection '${this.config.collectionName}'`
        );
      }
    } catch (err) {
      console.warn('Error clearing Qdrant collection:', err);
    }

    // Mark adapter as un-initialised so next index recreates collection
    this.initialized = false;
    this.vectorStore = null;
  }
}
