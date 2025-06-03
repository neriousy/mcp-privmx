/**
 * Embeddings Service (Production Implementation)
 *
 * Uses OpenAI's text-embedding-3-small model to generate vector embeddings
 * for document chunks to enable semantic search functionality.
 */

import OpenAI from 'openai';
import type { DocumentChunk } from '@privmx/shared';
import { promises as fs } from 'fs';
import path from 'path';
import { EmbeddingsTracker, type SyncResult } from './embeddings-tracker.js';

/**
 * Configuration for embeddings service
 */
export interface EmbeddingsConfig {
  apiKey?: string;
  model: string;
  maxTokens: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  metadata: {
    model: string;
    tokens: number;
    timestamp: string;
    processingTime: number;
  };
}

/**
 * Batch processing result
 */
export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  processingTime: number;
  errors: Array<{
    chunkId: string;
    error: string;
  }>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EmbeddingsConfig = {
  model: 'text-embedding-3-small',
  maxTokens: 8191, // Max for text-embedding-3-small
  batchSize: 100, // OpenAI's recommended batch size
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Embeddings Service Class
 */
export class EmbeddingsService {
  private openai: OpenAI;
  private config: EmbeddingsConfig;
  private cache: Map<string, EmbeddingResult> = new Map();
  private tracker: EmbeddingsTracker | null = null;

  constructor(config: Partial<EmbeddingsConfig> = {}, dataPath?: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize OpenAI client
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.openai = new OpenAI({
      apiKey,
    });

    // Initialize tracker if dataPath provided
    if (dataPath) {
      this.tracker = new EmbeddingsTracker(dataPath);
    }
  }

  /**
   * Generate embeddings for a batch of document chunks
   */
  async generateEmbeddings(
    chunks: DocumentChunk[]
  ): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);

    const results: EmbeddingResult[] = [];
    const errors: Array<{ chunkId: string; error: string }> = [];
    let totalTokens = 0;

    // Process in batches
    const batches = this.createBatches(chunks, this.config.batchSize);
    console.log(`📦 Processing ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} items)...`
      );

      try {
        const batchResult = await this.processBatch(batch);
        results.push(...batchResult.results);
        totalTokens += batchResult.totalTokens;

        if (batchResult.errors.length > 0) {
          errors.push(...batchResult.errors);
        }

        // Small delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(200);
        }
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);

        // Add all chunks in failed batch to errors
        batch.forEach((chunk) => {
          errors.push({
            chunkId: chunk.id,
            error:
              error instanceof Error ? error.message : 'Unknown batch error',
          });
        });
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `✅ Generated ${results.length} embeddings in ${processingTime}ms`
    );
    console.log(`📊 Total tokens used: ${totalTokens}`);

    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} chunks failed to process`);
    }

    return {
      results,
      totalTokens,
      processingTime,
      errors,
    };
  }

  /**
   * Generate embedding for a single text query
   */
  async generateQueryEmbedding(text: string): Promise<number[]> {
    const preprocessedText = this.preprocessText(text);

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: preprocessedText,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(
        `Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process a single batch of chunks
   */
  private async processBatch(chunks: DocumentChunk[]): Promise<{
    results: EmbeddingResult[];
    totalTokens: number;
    errors: Array<{ chunkId: string; error: string }>;
  }> {
    const results: EmbeddingResult[] = [];
    const errors: Array<{ chunkId: string; error: string }> = [];

    // Prepare texts for embedding
    const textsToEmbed = chunks.map((chunk) =>
      this.prepareTextForEmbedding(chunk)
    );

    let attempt = 0;
    while (attempt < this.config.retryAttempts) {
      try {
        const startTime = Date.now();

        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: textsToEmbed,
          encoding_format: 'float',
        });

        const processingTime = Date.now() - startTime;

        // Process results
        for (let i = 0; i < response.data.length; i++) {
          const embedding = response.data[i];
          const chunk = chunks[i];

          results.push({
            chunkId: chunk.id,
            embedding: embedding.embedding,
            metadata: {
              model: this.config.model,
              tokens: response.usage?.total_tokens || 0,
              timestamp: new Date().toISOString(),
              processingTime,
            },
          });
        }

        return {
          results,
          totalTokens: response.usage?.total_tokens || 0,
          errors,
        };
      } catch (error) {
        attempt++;
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';

        if (attempt >= this.config.retryAttempts) {
          // Final attempt failed, add all chunks to errors
          chunks.forEach((chunk) => {
            errors.push({
              chunkId: chunk.id,
              error: `Max retries exceeded: ${errorMsg}`,
            });
          });
          break;
        }

        console.warn(
          `⚠️  Batch attempt ${attempt} failed: ${errorMsg}. Retrying...`
        );
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    return { results, totalTokens: 0, errors };
  }

  /**
   * Prepare text from document chunk for embedding
   */
  private prepareTextForEmbedding(chunk: DocumentChunk): string {
    let text = chunk.content;

    // Add metadata context for better embedding quality
    const contextParts = [];

    if (chunk.metadata.namespace) {
      contextParts.push(`Namespace: ${chunk.metadata.namespace}`);
    }

    if (chunk.metadata.className) {
      contextParts.push(`Class: ${chunk.metadata.className}`);
    }

    if (chunk.metadata.methodName) {
      contextParts.push(`Method: ${chunk.metadata.methodName}`);
    }

    if (chunk.metadata.type) {
      contextParts.push(`Type: ${chunk.metadata.type}`);
    }

    if (contextParts.length > 0) {
      text = contextParts.join(', ') + '\n\n' + text;
    }

    return this.preprocessText(text);
  }

  /**
   * Preprocess text for better embedding quality
   */
  private preprocessText(text: string): string {
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long (leave some buffer for tokenization differences)
    const maxLength = this.config.maxTokens * 3; // Rough character to token ratio
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
      console.warn(`⚠️  Text truncated to ${maxLength} characters`);
    }

    return text;
  }

  /**
   * Create batches from chunks array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get embedding dimensions for current model
   */
  getEmbeddingDimensions(): number {
    switch (this.config.model) {
      case 'text-embedding-3-small':
        return 1536;
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536; // Default fallback
    }
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text is within token limits
   */
  isWithinTokenLimits(text: string): boolean {
    return this.estimateTokens(text) <= this.config.maxTokens;
  }

  /**
   * Get configuration info
   */
  getConfig(): {
    model: string;
    maxTokens: number;
    batchSize: number;
    dimensions: number;
  } {
    return {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      batchSize: this.config.batchSize,
      dimensions: this.getEmbeddingDimensions(),
    };
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
}
