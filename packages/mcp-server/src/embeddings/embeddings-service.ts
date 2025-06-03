/**
 * Embeddings Service
 *
 * Handles vector embedding generation using OpenAI's text-embedding-3-small model.
 * Provides efficient batch processing and caching capabilities.
 */

import OpenAI from 'openai';
import type { DocumentChunk } from '@privmx/shared';
import { promises as fs } from 'fs';
import path from 'path';
import { EmbeddingsTracker, type SyncResult } from './embeddings-tracker.js';

/**
 * Configuration for embeddings generation
 */
export interface EmbeddingsConfig {
  apiKey: string;
  model: string;
  batchSize: number;
  maxTokens: number;
  cacheDir?: string;
}

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  metadata: {
    model: string;
    tokens: number;
    timestamp: string;
  };
}

/**
 * Batch processing result
 */
export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
  processingTime: number;
  batchCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<EmbeddingsConfig> = {
  model: 'text-embedding-3-small',
  batchSize: 100,
  maxTokens: 8192,
};

/**
 * Embeddings Service Class with Persistent Tracking
 */
export class EmbeddingsService {
  private openai: OpenAI;
  private config: EmbeddingsConfig;
  private cache: Map<string, EmbeddingResult> = new Map();
  private tracker: EmbeddingsTracker | null = null;

  constructor(config: EmbeddingsConfig, dataPath?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
    });

    // Initialize tracker if dataPath provided
    if (dataPath) {
      this.tracker = new EmbeddingsTracker(dataPath);
    }
  }

  /**
   * Generate embeddings for a batch of document chunks with tracking
   */
  async generateEmbeddings(
    chunks: DocumentChunk[]
  ): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    let totalTokens = 0;
    let batchCount = 0;

    console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`);

    // Sync with tracker if available
    let chunksToProcess = chunks;
    if (this.tracker) {
      const syncResult = await this.tracker.syncChunks(chunks);
      chunksToProcess = [...syncResult.newChunks, ...syncResult.updatedChunks];

      if (chunksToProcess.length === 0) {
        console.log('✅ All chunks already have embeddings.');
        return {
          embeddings: [],
          totalTokens: 0,
          processingTime: 0,
          batchCount: 0,
        };
      }

      console.log(
        `📊 Processing ${chunksToProcess.length} chunks that need embeddings`
      );
    }

    const allEmbeddings: EmbeddingResult[] = [];

    // Process chunks in batches
    for (let i = 0; i < chunksToProcess.length; i += this.config.batchSize) {
      const batch = chunksToProcess.slice(i, i + this.config.batchSize);
      batchCount++;

      console.log(
        `📦 Processing batch ${batchCount}/${Math.ceil(chunksToProcess.length / this.config.batchSize)} (${batch.length} chunks)`
      );

      try {
        const batchResult = await this.processBatch(batch);
        allEmbeddings.push(...batchResult.embeddings);
        totalTokens += batchResult.totalTokens;

        // Update tracker for successful embeddings
        if (this.tracker) {
          for (const embedding of batchResult.embeddings) {
            await this.tracker.markEmbeddingCompleted(
              embedding.chunkId,
              embedding
            );
          }
        }

        // Add delay between batches to respect rate limits
        if (i + this.config.batchSize < chunksToProcess.length) {
          await this.delay(100); // 100ms delay
        }
      } catch (error) {
        console.error(`❌ Failed to process batch ${batchCount}:`, error);

        // Mark failed chunks in tracker
        if (this.tracker) {
          for (const chunk of batch) {
            await this.tracker.markEmbeddingFailed(
              chunk.id,
              error instanceof Error ? error.message : 'Unknown error'
            );
          }
        }

        throw new Error(
          `Embedding generation failed at batch ${batchCount}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `✅ Generated ${allEmbeddings.length} embeddings in ${processingTime}ms`
    );
    console.log(`📊 Total tokens used: ${totalTokens}`);

    return {
      embeddings: allEmbeddings,
      totalTokens,
      processingTime,
      batchCount,
    };
  }

  /**
   * Process a single batch of chunks
   */
  private async processBatch(chunks: DocumentChunk[]): Promise<{
    embeddings: EmbeddingResult[];
    totalTokens: number;
  }> {
    // Check cache first
    const uncachedChunks = chunks.filter((chunk) => !this.cache.has(chunk.id));
    const cachedEmbeddings = chunks
      .filter((chunk) => this.cache.has(chunk.id))
      .map((chunk) => this.cache.get(chunk.id)!);

    if (uncachedChunks.length === 0) {
      console.log(`📋 All ${chunks.length} chunks found in cache`);
      return {
        embeddings: cachedEmbeddings,
        totalTokens: 0, // No API calls made
      };
    }

    console.log(
      `🆕 Processing ${uncachedChunks.length} new chunks (${cachedEmbeddings.length} cached)`
    );

    // Prepare input texts
    const inputTexts = uncachedChunks.map((chunk) =>
      this.prepareTextForEmbedding(chunk)
    );

    // Make API call
    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: inputTexts,
      encoding_format: 'float',
    });

    // Process results
    const newEmbeddings: EmbeddingResult[] = response.data.map(
      (embedding, index) => {
        const chunk = uncachedChunks[index];
        const result: EmbeddingResult = {
          chunkId: chunk.id,
          embedding: embedding.embedding,
          metadata: {
            model: this.config.model,
            tokens: this.estimateTokens(inputTexts[index]),
            timestamp: new Date().toISOString(),
          },
        };

        // Cache the result
        this.cache.set(chunk.id, result);

        return result;
      }
    );

    return {
      embeddings: [...cachedEmbeddings, ...newEmbeddings],
      totalTokens: response.usage.total_tokens,
    };
  }

  /**
   * Prepare chunk text for embedding generation
   */
  private prepareTextForEmbedding(chunk: DocumentChunk): string {
    // Combine content with important metadata for better embeddings
    const parts = [chunk.content];

    // Add metadata context
    if (chunk.metadata.namespace) {
      parts.unshift(`Namespace: ${chunk.metadata.namespace}`);
    }

    if (chunk.metadata.className) {
      parts.unshift(`Class: ${chunk.metadata.className}`);
    }

    if (chunk.metadata.methodName) {
      parts.unshift(`Method: ${chunk.metadata.methodName}`);
    }

    if (chunk.metadata.type) {
      parts.unshift(`Type: ${chunk.metadata.type}`);
    }

    const fullText = parts.join('\n\n');

    // Truncate if too long (roughly estimate tokens)
    if (this.estimateTokens(fullText) > this.config.maxTokens) {
      const maxChars = this.config.maxTokens * 3; // Rough estimate: 1 token ≈ 3-4 chars
      return fullText.substring(0, maxChars) + '...';
    }

    return fullText;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 3.5 characters for English text
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Save embeddings to file
   */
  async saveEmbeddings(
    embeddings: EmbeddingResult[],
    filePath: string
  ): Promise<void> {
    const data = {
      metadata: {
        count: embeddings.length,
        model: this.config.model,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
      embeddings: embeddings.map((emb) => ({
        chunkId: emb.chunkId,
        embedding: emb.embedding,
        metadata: emb.metadata,
      })),
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${embeddings.length} embeddings to ${filePath}`);
  }

  /**
   * Load embeddings from file
   */
  async loadEmbeddings(filePath: string): Promise<EmbeddingResult[]> {
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      // Populate cache
      data.embeddings.forEach((emb: any) => {
        this.cache.set(emb.chunkId, emb);
      });

      console.log(`📂 Loaded ${data.embeddings.length} embeddings from cache`);
      return data.embeddings;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log('📂 No cached embeddings found');
        return [];
      }
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embeddings to a query
   */
  async findSimilar(
    queryEmbedding: number[],
    candidateEmbeddings: EmbeddingResult[],
    limit: number = 10,
    threshold: number = 0.5
  ): Promise<Array<EmbeddingResult & { similarity: number }>> {
    const similarities = candidateEmbeddings.map((candidate) => ({
      ...candidate,
      similarity: EmbeddingsService.cosineSimilarity(
        queryEmbedding,
        candidate.embedding
      ),
    }));

    return similarities
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Generate embedding for a single query text
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.config.model,
      input: query,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  }

  /**
   * Get embedding statistics
   */
  getStats(): {
    cacheSize: number;
    model: string;
    maxTokens: number;
  } {
    return {
      cacheSize: this.cache.size,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get tracking statistics
   */
  getTrackingStats() {
    return this.tracker?.getTrackingStats() || null;
  }

  /**
   * Get chunks that need embedding
   */
  getChunksNeedingEmbedding() {
    return this.tracker?.getChunksNeedingEmbedding() || [];
  }

  /**
   * Reset failed embeddings
   */
  resetFailedEmbeddings(): number {
    return this.tracker?.resetFailedEmbeddings() || 0;
  }

  /**
   * Close the tracker database connection
   */
  close(): void {
    if (this.tracker) {
      this.tracker.close();
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
