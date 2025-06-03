#!/usr/bin/env node

/**
 * Embeddings Generation Script
 *
 * Generates vector embeddings for all processed documentation chunks
 * and stores them for semantic search functionality.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { EmbeddingsService } from '../embeddings/embeddings-service.js';
import type { DocumentChunk } from '@privmx/shared';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration for embeddings generation
 */
interface EmbeddingGenerationConfig {
  dataPath: string;
  outputPath: string;
  openaiApiKey: string;
  batchSize: number;
  forceRegenerate: boolean;
}

/**
 * Main embeddings generation class
 */
class EmbeddingGenerator {
  private config: EmbeddingGenerationConfig;
  private embeddingsService: EmbeddingsService;

  constructor(config: Partial<EmbeddingGenerationConfig> = {}) {
    const defaultConfig: EmbeddingGenerationConfig = {
      dataPath: path.join(__dirname, '../../../../data'),
      outputPath: path.join(__dirname, '../../../../data/embeddings.json'),
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      batchSize: 50, // Smaller batches for better rate limiting
      forceRegenerate: false,
    };

    this.config = { ...defaultConfig, ...config };

    if (!this.config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.embeddingsService = new EmbeddingsService(
      {
        apiKey: this.config.openaiApiKey,
        model: 'text-embedding-3-small',
        batchSize: this.config.batchSize,
        maxTokens: 8000,
      },
      this.config.dataPath // Enable persistent tracking
    );
  }

  /**
   * Generate embeddings for all processed chunks
   */
  async generateEmbeddings(): Promise<void> {
    console.log('🚀 Starting embeddings generation...\n');

    try {
      // Load processed chunks
      const chunks = await this.loadProcessedChunks();
      console.log(`📦 Loaded ${chunks.length} processed chunks`);

      // Check if embeddings already exist
      if (!this.config.forceRegenerate) {
        const existingEmbeddings = await this.loadExistingEmbeddings();
        if (existingEmbeddings.length > 0) {
          console.log(
            `📂 Found ${existingEmbeddings.length} existing embeddings`
          );

          // Check if we need to generate embeddings for new chunks
          const existingChunkIds = new Set(
            existingEmbeddings.map((emb) => emb.chunkId)
          );
          const newChunks = chunks.filter(
            (chunk) => !existingChunkIds.has(chunk.id)
          );

          if (newChunks.length === 0) {
            console.log(
              '✅ All chunks already have embeddings. Use --force to regenerate.'
            );
            return;
          }

          console.log(
            `🆕 Found ${newChunks.length} new chunks that need embeddings`
          );

          // Generate embeddings only for new chunks
          const newEmbeddings =
            await this.embeddingsService.generateEmbeddings(newChunks);
          const allEmbeddings = [
            ...existingEmbeddings,
            ...newEmbeddings.embeddings,
          ];

          // Save updated embeddings
          await this.embeddingsService.saveEmbeddings(
            allEmbeddings,
            this.config.outputPath
          );

          console.log(
            `\n✅ Generated ${newEmbeddings.embeddings.length} new embeddings`
          );
          console.log(`📊 Total embeddings: ${allEmbeddings.length}`);
          console.log(`💰 Total tokens used: ${newEmbeddings.totalTokens}`);
          console.log(`⏱️  Processing time: ${newEmbeddings.processingTime}ms`);

          return;
        }
      }

      // Generate embeddings for all chunks
      console.log('🔄 Generating embeddings for all chunks...');
      const result = await this.embeddingsService.generateEmbeddings(chunks);

      // Save embeddings to file
      await this.embeddingsService.saveEmbeddings(
        result.embeddings,
        this.config.outputPath
      );

      // Generate summary
      await this.generateSummary(result, chunks.length);

      console.log('\n✅ Embeddings generation completed successfully!');
      console.log(`📊 Generated ${result.embeddings.length} embeddings`);
      console.log(`💰 Total tokens used: ${result.totalTokens}`);
      console.log(`⏱️  Processing time: ${result.processingTime}ms`);
      console.log(`💾 Embeddings saved to: ${this.config.outputPath}`);
    } catch (error) {
      console.error(
        '\n❌ Embeddings generation failed:',
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Load processed chunks from the data directory
   */
  private async loadProcessedChunks(): Promise<DocumentChunk[]> {
    const chunksFile = path.join(this.config.dataPath, 'processed-chunks.json');

    try {
      const data = JSON.parse(await fs.readFile(chunksFile, 'utf-8'));
      return data.chunks || [];
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(
          `No processed chunks found at ${chunksFile}. Run documentation indexing first.`
        );
      }
      throw error;
    }
  }

  /**
   * Load existing embeddings if they exist
   */
  private async loadExistingEmbeddings(): Promise<any[]> {
    try {
      return await this.embeddingsService.loadEmbeddings(
        this.config.outputPath
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate summary of embeddings generation
   */
  private async generateSummary(
    result: any,
    totalChunks: number
  ): Promise<void> {
    // Get tracking statistics
    const trackingStats = this.embeddingsService.getTrackingStats();

    const summary = {
      timestamp: new Date().toISOString(),
      configuration: {
        model: 'text-embedding-3-small',
        batchSize: this.config.batchSize,
        totalInputChunks: totalChunks,
        trackingEnabled: true,
      },
      results: {
        embeddingsGenerated: result.embeddings.length,
        totalTokensUsed: result.totalTokens,
        processingTimeMs: result.processingTime,
        batchCount: result.batchCount,
        averageTokensPerChunk: Math.round(
          result.totalTokens / result.embeddings.length || 0
        ),
      },
      tracking: trackingStats || {
        note: 'Tracking stats not available in this run',
      },
      costs: {
        // text-embedding-3-small pricing: $0.00002 per 1K tokens
        estimatedCostUSD: (result.totalTokens / 1000) * 0.00002,
      },
      files: {
        inputChunks: path.join(this.config.dataPath, 'processed-chunks.json'),
        outputEmbeddings: this.config.outputPath,
        trackingDatabase: trackingStats
          ? path.join(this.config.dataPath, 'embeddings-tracker.db')
          : null,
      },
      nextSteps: [
        'Phase 5: Store embeddings in Qdrant Vector Database',
        'Phase 6: Implement semantic search in MCP server',
        'Phase 7: Add advanced retrieval strategies',
      ],
    };

    const summaryPath = path.join(
      this.config.dataPath,
      'embeddings-summary.json'
    );
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n📋 Summary saved to: ${summaryPath}`);
  }

  /**
   * Test embeddings with a sample query
   */
  async testEmbeddings(query: string = 'createThread method'): Promise<void> {
    console.log(`\n🧪 Testing embeddings with query: "${query}"`);

    try {
      // Load embeddings
      const embeddings = await this.loadExistingEmbeddings();
      if (embeddings.length === 0) {
        throw new Error('No embeddings found. Generate embeddings first.');
      }

      // Generate query embedding
      const queryEmbedding =
        await this.embeddingsService.generateQueryEmbedding(query);

      // Find similar embeddings
      const similar = await this.embeddingsService.findSimilar(
        queryEmbedding,
        embeddings,
        5,
        0.7 // Higher threshold for test
      );

      console.log(`\n📍 Found ${similar.length} relevant results:`);
      similar.forEach((result, index) => {
        console.log(
          `\n${index + 1}. Similarity: ${result.similarity.toFixed(3)}`
        );
        console.log(`   Chunk ID: ${result.chunkId}`);
        console.log(`   Model: ${result.metadata.model}`);
        console.log(`   Tokens: ${result.metadata.tokens}`);
      });
    } catch (error) {
      console.error(
        '❌ Embeddings test failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Get generation statistics
   */
  getStats(): any {
    return this.embeddingsService.getStats();
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = {
    force: args.includes('--force'),
    test: args.includes('--test'),
    help: args.includes('--help') || args.includes('-h'),
  };

  if (flags.help) {
    console.log(`
🔧 PrivMX Embeddings Generator

Usage: tsx generate-embeddings.ts [options]

Options:
  --force    Force regeneration of all embeddings
  --test     Test embeddings with a sample query
  --help     Show this help message

Environment Variables:
  OPENAI_API_KEY    Required. Your OpenAI API key

Examples:
  tsx generate-embeddings.ts
  tsx generate-embeddings.ts --force
  tsx generate-embeddings.ts --test
`);
    return;
  }

  try {
    const generator = new EmbeddingGenerator({
      forceRegenerate: flags.force,
    });

    if (flags.test) {
      await generator.testEmbeddings();
    } else {
      await generator.generateEmbeddings();
    }
  } catch (error) {
    console.error(
      '❌ Script failed:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EmbeddingGenerator };
