/**
 * Qdrant Vector Database Service (Production Implementation)
 *
 * Real implementation using @qdrant/js-client-rest for vector storage and semantic search.
 * Provides efficient similarity search, metadata filtering, and collection management.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { DocumentChunk } from '@privmx/shared';
import type { EmbeddingResult } from '../embeddings/embeddings-service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for Qdrant service
 */
export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
}

/**
 * Search result with similarity score
 */
export interface VectorSearchResult {
  chunk: DocumentChunk;
  similarity: number;
  metadata: Record<string, any>;
  vectorId: string;
}

/**
 * Search filters for vector queries
 */
export interface SearchFilters {
  namespace?: string;
  type?: string;
  importance?: string;
  tags?: string[];
  className?: string;
  methodName?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<QdrantConfig> = {
  url: 'http://localhost:6333',
  collectionName: 'privmx-docs',
  vectorSize: 1536, // text-embedding-3-small dimension
  distance: 'Cosine',
};

/**
 * Qdrant Service Class (Production Implementation)
 */
export class QdrantService {
  private client: QdrantClient;
  private config: QdrantConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<QdrantConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as QdrantConfig;

    const clientConfig: any = {
      url: this.config.url,
      checkCompatibility: false, // Skip version compatibility check
    };

    if (this.config.apiKey) {
      clientConfig.apiKey = this.config.apiKey;
    }

    this.client = new QdrantClient(clientConfig);
  }

  /**
   * Initialize the Qdrant collection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log(`🔗 Connecting to Qdrant at ${this.config.url}...`);

      // Check if collection exists
      let collectionExists = true;
      try {
        console.log(
          `🔍 Checking if collection exists: ${this.config.collectionName}`
        );
        await this.client.collectionExists(this.config.collectionName);
      } catch {
        console.log(
          `❌ Collection does not exist: ${this.config.collectionName}`
        );
        collectionExists = false;
      }

      if (collectionExists) {
        const info = await this.client.getCollection(
          this.config.collectionName
        );
        console.log(
          `✅ Connected to existing collection: ${this.config.collectionName}`
        );
        console.log(`📊 Collection has ${info.points_count || 0} points`);
      } else {
        // Collection doesn't exist, create it
        console.log(
          `📝 Creating new collection: ${this.config.collectionName}`
        );

        // Map distance metric to Qdrant format
        const qdrantDistance =
          this.config.distance === 'Euclidean'
            ? 'Euclid'
            : this.config.distance;

        await this.client.createCollection(this.config.collectionName, {
          vectors: {
            size: this.config.vectorSize,
            distance: qdrantDistance as any,
          },
          optimizers_config: {
            default_segment_number: 2,
            max_segment_size: 20000,
            memmap_threshold: 20000,
            indexing_threshold: 20000,
          },
          replication_factor: 1,
          write_consistency_factor: 1,
        });

        console.log(`✅ Created new collection: ${this.config.collectionName}`);
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Qdrant: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Store embeddings and chunks in Qdrant
   */
  async storeEmbeddings(
    chunks: DocumentChunk[],
    embeddings: EmbeddingResult[]
  ): Promise<void> {
    await this.initialize();

    console.log(`💾 Storing ${embeddings.length} embeddings in Qdrant...`);

    // Create a map for quick lookup
    const embeddingMap = new Map(embeddings.map((emb) => [emb.chunkId, emb]));

    // Prepare points for Qdrant
    const points = [];

    for (const chunk of chunks) {
      const embedding = embeddingMap.get(chunk.id);
      if (!embedding) {
        console.warn(`⚠️  No embedding found for chunk ${chunk.id}, skipping`);
        continue;
      }

      // Create point with vector and payload
      const point = {
        id: uuidv4(), // Generate unique vector ID
        vector: embedding.embedding,
        payload: {
          // Document information
          chunkId: chunk.id,
          content: chunk.content,

          // Metadata
          namespace: chunk.metadata.namespace,
          type: chunk.metadata.type,
          importance: chunk.metadata.importance,
          className: chunk.metadata.className || null,
          methodName: chunk.metadata.methodName || null,
          sourceFile: chunk.metadata.sourceFile,
          lineNumber: chunk.metadata.lineNumber || null,
          tags: chunk.metadata.tags,
          relatedMethods: chunk.metadata.relatedMethods || [],
          dependencies: chunk.metadata.dependencies || [],
          commonMistakes: chunk.metadata.commonMistakes || [],
          useCases: chunk.metadata.useCases || [],

          // Embedding metadata
          embeddingModel: embedding.metadata.model,
          embeddingTokens: embedding.metadata.tokens,
          embeddingTimestamp: embedding.metadata.timestamp,

          // Search optimization
          searchText: this.prepareSearchText(chunk),
        },
      };

      points.push(point);
    }

    try {
      // Upload points in batches
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);

        await this.client.upsert(this.config.collectionName, {
          wait: true,
          points: batch,
        });

        console.log(
          `📦 Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)} (${batch.length} points)`
        );
      }

      console.log(`✅ Stored ${points.length} embeddings in Qdrant`);
    } catch (error) {
      throw new Error(
        `Failed to store embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  async search(
    queryEmbedding: number[],
    filters: SearchFilters = {},
    limit: number = 10,
    scoreThreshold: number = 0.7
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    try {
      // Build filter conditions
      const mustConditions = [];

      if (filters.namespace) {
        mustConditions.push({
          key: 'namespace',
          match: { value: filters.namespace },
        });
      }

      if (filters.type) {
        mustConditions.push({
          key: 'type',
          match: { value: filters.type },
        });
      }

      if (filters.importance) {
        mustConditions.push({
          key: 'importance',
          match: { value: filters.importance },
        });
      }

      if (filters.className) {
        mustConditions.push({
          key: 'className',
          match: { value: filters.className },
        });
      }

      if (filters.methodName) {
        mustConditions.push({
          key: 'methodName',
          match: { value: filters.methodName },
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        mustConditions.push({
          key: 'tags',
          match: { any: filters.tags },
        });
      }

      const searchParams: any = {
        vector: queryEmbedding,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
        with_vector: false,
      };

      if (mustConditions.length > 0) {
        searchParams.filter = {
          must: mustConditions,
        };
      }

      const response = await this.client.search(
        this.config.collectionName,
        searchParams
      );

      // Transform results
      const searchResults: VectorSearchResult[] = response.map((hit: any) => {
        const payload = hit.payload as any;

        // Reconstruct chunk from Qdrant payload
        const chunk: DocumentChunk = {
          id: payload.chunkId,
          content: payload.content,
          metadata: {
            type: payload.type,
            namespace: payload.namespace,
            className: payload.className || undefined,
            methodName: payload.methodName || undefined,
            importance: payload.importance,
            tags: payload.tags || [],
            sourceFile: payload.sourceFile,
            lineNumber: payload.lineNumber || undefined,
            relatedMethods: payload.relatedMethods || undefined,
            dependencies: payload.dependencies || undefined,
            commonMistakes: payload.commonMistakes || undefined,
            useCases: payload.useCases || undefined,
          },
        };

        return {
          chunk,
          similarity: hit.score,
          metadata: payload,
          vectorId: hit.id.toString(),
        };
      });

      console.log(`🔍 Vector search returned ${searchResults.length} results`);
      return searchResults;
    } catch (error) {
      throw new Error(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    collectionName: string;
    url: string;
    vectorSize: number;
    distance: string;
  }> {
    await this.initialize();

    try {
      const info = await this.client.getCollection(this.config.collectionName);

      return {
        totalDocuments: info.points_count || 0,
        collectionName: this.config.collectionName,
        url: this.config.url,
        vectorSize: this.config.vectorSize,
        distance: this.config.distance,
      };
    } catch (error) {
      throw new Error(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete the entire collection (for cleanup)
   */
  async deleteCollection(): Promise<void> {
    await this.initialize();

    try {
      await this.client.deleteCollection(this.config.collectionName);
      this.isInitialized = false;
      console.log(`🗑️  Deleted collection: ${this.config.collectionName}`);
    } catch (error) {
      throw new Error(
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if Qdrant is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.warn(
        `⚠️  Qdrant health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Get similar documents by chunk ID
   */
  async getSimilarDocuments(
    chunkId: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    await this.initialize();

    try {
      // First find the vector for the given chunk
      const searchResponse = await this.client.scroll(
        this.config.collectionName,
        {
          filter: {
            must: [
              {
                key: 'chunkId',
                match: { value: chunkId },
              },
            ],
          },
          limit: 1,
          with_vector: true,
          with_payload: true,
        }
      );

      if (!searchResponse.points || searchResponse.points.length === 0) {
        throw new Error(`Chunk ${chunkId} not found in vector database`);
      }

      const sourcePoint = searchResponse.points[0];
      const queryVector = sourcePoint.vector as number[];

      // Search for similar documents, excluding the original
      const similarResponse = await this.client.search(
        this.config.collectionName,
        {
          vector: queryVector,
          limit: limit + 1, // +1 to account for excluding the original
          with_payload: true,
          with_vector: false,
          filter: {
            must_not: [
              {
                key: 'chunkId',
                match: { value: chunkId },
              },
            ],
          },
        }
      );

      const searchResults: VectorSearchResult[] = similarResponse
        .slice(0, limit)
        .map((hit: any) => {
          const payload = hit.payload as any;

          const chunk: DocumentChunk = {
            id: payload.chunkId,
            content: payload.content,
            metadata: {
              type: payload.type,
              namespace: payload.namespace,
              className: payload.className || undefined,
              methodName: payload.methodName || undefined,
              importance: payload.importance,
              tags: payload.tags || [],
              sourceFile: payload.sourceFile,
              lineNumber: payload.lineNumber || undefined,
              relatedMethods: payload.relatedMethods || undefined,
              dependencies: payload.dependencies || undefined,
              commonMistakes: payload.commonMistakes || undefined,
              useCases: payload.useCases || undefined,
            },
          };

          return {
            chunk,
            similarity: hit.score,
            metadata: payload,
            vectorId: hit.id.toString(),
          };
        });

      return searchResults;
    } catch (error) {
      throw new Error(
        `Failed to get similar documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete specific points by chunk IDs
   */
  async deleteByChunkIds(chunkIds: string[]): Promise<void> {
    await this.initialize();

    try {
      await this.client.delete(this.config.collectionName, {
        filter: {
          must: [
            {
              key: 'chunkId',
              match: { any: chunkIds },
            },
          ],
        },
      });

      console.log(`🗑️  Deleted ${chunkIds.length} chunks from Qdrant`);
    } catch (error) {
      throw new Error(
        `Failed to delete chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Prepare search text for better retrieval
   */
  private prepareSearchText(chunk: DocumentChunk): string {
    const parts = [chunk.content];

    if (chunk.metadata.namespace) {
      parts.push(chunk.metadata.namespace);
    }

    if (chunk.metadata.className) {
      parts.push(chunk.metadata.className);
    }

    if (chunk.metadata.methodName) {
      parts.push(chunk.metadata.methodName);
    }

    if (chunk.metadata.tags.length > 0) {
      parts.push(...chunk.metadata.tags);
    }

    return parts.join(' ').toLowerCase();
  }

  /**
   * Update collection configuration
   */
  async updateCollection(
    config: Partial<{
      optimizers_config: any;
      replication_factor: number;
    }>
  ): Promise<void> {
    await this.initialize();

    try {
      await this.client.updateCollection(this.config.collectionName, config);
      console.log(`⚙️  Updated collection configuration`);
    } catch (error) {
      throw new Error(
        `Failed to update collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create collection index for better performance
   */
  async createFieldIndex(fieldName: string): Promise<void> {
    await this.initialize();

    try {
      await this.client.createPayloadIndex(this.config.collectionName, {
        field_name: fieldName,
        field_schema: 'keyword',
      });
      console.log(`📇 Created index for field: ${fieldName}`);
    } catch (error) {
      throw new Error(
        `Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Count documents in collection
   */
  async countDocuments(filters?: SearchFilters): Promise<number> {
    await this.initialize();

    try {
      const mustConditions = [];

      if (filters?.namespace) {
        mustConditions.push({
          key: 'namespace',
          match: { value: filters.namespace },
        });
      }

      if (filters?.type) {
        mustConditions.push({
          key: 'type',
          match: { value: filters.type },
        });
      }

      const countParams: any = {};
      if (mustConditions.length > 0) {
        countParams.filter = { must: mustConditions };
      }

      const result = await this.client.count(
        this.config.collectionName,
        countParams
      );
      return result.count || 0;
    } catch (error) {
      throw new Error(
        `Failed to count documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get detailed embedding information
   */
  async getEmbeddingInfo(): Promise<{
    totalPoints: number;
    vectorDimensions: number;
    collectionName: string;
    distance: string;
    status: string;
  }> {
    await this.initialize();

    try {
      const info = await this.client.getCollection(this.config.collectionName);
      return {
        totalPoints: info.points_count || 0,
        vectorDimensions: this.config.vectorSize,
        collectionName: this.config.collectionName,
        distance: this.config.distance,
        status: info.status || 'unknown',
      };
    } catch (error) {
      throw new Error(
        `Failed to get embedding info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
