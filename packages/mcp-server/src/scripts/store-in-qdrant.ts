#!/usr/bin/env node

/**
 * Qdrant Storage Script
 *
 * Stores generated embeddings in Qdrant vector database for semantic search.
 * Integrates with the embeddings tracker for incremental updates.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { QdrantService } from '../vector-db/qdrant-service.js';
import { EmbeddingsService } from '../embeddings/embeddings-service.js';
import type { DocumentChunk } from '@privmx/shared';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration for Qdrant storage
 */
interface QdrantStorageConfig {
  dataPath: string;
  qdrantUrl: string;
  qdrantApiKey?: string;
  collectionName: string;
  force: boolean;
}

/**
 * Qdrant Storage Manager
 */
class QdrantStorageManager {
  private config: QdrantStorageConfig;
  private qdrantService: QdrantService;
  private embeddingsService: EmbeddingsService;

  constructor(config: Partial<QdrantStorageConfig> = {}) {
    const defaultConfig: QdrantStorageConfig = {
      dataPath: path.join(__dirname, '../../../../data'),
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: process.env.QDRANT_API_KEY,
      collectionName: 'privmx-docs',
      force: false,
    };

    this.config = { ...defaultConfig, ...config };

    // Initialize services
    this.qdrantService = new QdrantService({
      url: this.config.qdrantUrl,
      apiKey: this.config.qdrantApiKey,
      collectionName: this.config.collectionName,
      vectorSize: 1536, // text-embedding-3-small dimensions
      distance: 'Cosine',
    });

    // Initialize embeddings service with tracker (read-only mode)
    this.embeddingsService = new EmbeddingsService(
      {
        apiKey: process.env.OPENAI_API_KEY || 'dummy', // Not used for loading
        model: 'text-embedding-3-small',
        batchSize: 50,
        maxTokens: 8000,
      },
      this.config.dataPath
    );
  }

  /**
   * Store all embeddings in Qdrant
   */
  async storeEmbeddings(): Promise<void> {
    console.log('🚀 Starting Qdrant storage process...\n');

    try {
      // Check Qdrant health
      const isHealthy = await this.qdrantService.healthCheck();
      if (!isHealthy) {
        throw new Error('Qdrant is not available. Please start Qdrant server.');
      }

      // Load chunks and embeddings
      const chunks = await this.loadProcessedChunks();
      const embeddings = await this.loadEmbeddings();

      console.log(`📦 Loaded ${chunks.length} chunks`);
      console.log(`🔢 Loaded ${embeddings.length} embeddings`);

      // Verify embeddings match chunks
      const embeddingMap = new Map(embeddings.map((emb) => [emb.chunkId, emb]));
      const chunksWithEmbeddings = chunks.filter((chunk) =>
        embeddingMap.has(chunk.id)
      );

      console.log(`✅ ${chunksWithEmbeddings.length} chunks have embeddings`);

      if (chunksWithEmbeddings.length === 0) {
        throw new Error(
          'No chunks with embeddings found. Generate embeddings first.'
        );
      }

      // Check if we need to force update
      if (!this.config.force) {
        const stats = await this.qdrantService.getStats();
        if (stats.totalDocuments > 0) {
          console.log(
            `📊 Qdrant already contains ${stats.totalDocuments} documents`
          );
          console.log('Use --force to replace existing data');
          return;
        }
      }

      // Initialize Qdrant collection
      await this.qdrantService.initialize();

      // Store embeddings
      const chunksToStore = chunksWithEmbeddings;
      const embeddingsToStore = chunksToStore.map(
        (chunk) => embeddingMap.get(chunk.id)!
      );

      console.log(`💾 Storing ${chunksToStore.length} embeddings in Qdrant...`);

      await this.qdrantService.storeEmbeddings(
        chunksToStore,
        embeddingsToStore
      );

      // Get final stats
      const finalStats = await this.qdrantService.getStats();

      // Generate storage summary
      await this.generateStorageSummary(chunksToStore.length, finalStats);

      console.log('\n✅ Qdrant storage completed successfully!');
      console.log(`📊 Stored ${finalStats.totalDocuments} documents`);
      console.log(`🗄️  Collection: ${finalStats.collectionName}`);
      console.log(`🔗 Qdrant URL: ${finalStats.url}`);
    } catch (error) {
      console.error(
        '\n❌ Qdrant storage failed:',
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Test Qdrant search functionality
   */
  async testSearch(query: string = 'createThread method'): Promise<void> {
    console.log(`\n🧪 Testing Qdrant search with query: "${query}"`);

    try {
      // Check if we have API key for generating query embeddings
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY required for search testing');
      }

      // Generate query embedding
      const queryEmbedding =
        await this.embeddingsService.generateQueryEmbedding(query);

      // Search Qdrant
      const results = await this.qdrantService.search(
        queryEmbedding,
        {}, // No filters
        5, // Limit
        0.7 // Threshold
      );

      console.log(`\n📍 Found ${results.length} relevant results:`);

      results.forEach((result, index) => {
        console.log(
          `\n${index + 1}. Similarity: ${result.similarity.toFixed(3)}`
        );
        console.log(`   Chunk ID: ${result.chunk.id}`);
        console.log(`   Namespace: ${result.chunk.metadata.namespace}`);
        console.log(`   Type: ${result.chunk.metadata.type}`);
        if (result.chunk.metadata.className) {
          console.log(`   Class: ${result.chunk.metadata.className}`);
        }
        if (result.chunk.metadata.methodName) {
          console.log(`   Method: ${result.chunk.metadata.methodName}`);
        }
        console.log(`   Content: ${result.chunk.content.substring(0, 100)}...`);
      });

      // Test filtering
      console.log('\n🔍 Testing filtered search (Core namespace only):');
      const filteredResults = await this.qdrantService.search(
        queryEmbedding,
        { namespace: 'Core' },
        3,
        0.7
      );

      console.log(`📍 Found ${filteredResults.length} Core namespace results`);
    } catch (error) {
      console.error(
        '❌ Search test failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Get Qdrant and tracking statistics
   */
  async getStats(): Promise<void> {
    console.log('\n📊 Current Statistics:\n');

    try {
      // Qdrant stats
      const qdrantStats = await this.qdrantService.getStats();
      console.log('🗄️  Qdrant Vector Database:');
      console.log(`   Documents: ${qdrantStats.totalDocuments}`);
      console.log(`   Collection: ${qdrantStats.collectionName}`);
      console.log(`   Vector size: ${qdrantStats.vectorSize}`);
      console.log(`   Distance metric: ${qdrantStats.distance}`);
      console.log(`   URL: ${qdrantStats.url}`);

      // Embeddings service stats
      const embeddingStats = this.embeddingsService.getStats();
      console.log('\n🔢 Embeddings Service:');
      console.log(`   Cache size: ${embeddingStats.cacheSize}`);
      console.log(`   Model: ${embeddingStats.model}`);
      console.log(`   Max tokens: ${embeddingStats.maxTokens}`);

      // Tracking stats
      const trackingStats = this.embeddingsService.getTrackingStats();
      if (trackingStats) {
        console.log('\n📊 Embeddings Tracking:');
        console.log(`   Total chunks: ${trackingStats.totalChunks}`);
        console.log(`   Embedded: ${trackingStats.embeddedChunks}`);
        console.log(`   Pending: ${trackingStats.pendingChunks}`);
        console.log(`   Failed: ${trackingStats.failedChunks}`);
        console.log(`   Outdated: ${trackingStats.outdatedChunks}`);
        console.log(`   Total tokens used: ${trackingStats.totalTokensUsed}`);
        console.log(`   Last update: ${trackingStats.lastUpdate}`);
      }
    } catch (error) {
      console.error(
        '❌ Failed to get stats:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Load processed chunks
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
   * Load embeddings
   */
  private async loadEmbeddings(): Promise<any[]> {
    const embeddingsFile = path.join(this.config.dataPath, 'embeddings.json');

    try {
      const data = JSON.parse(await fs.readFile(embeddingsFile, 'utf-8'));
      return data.embeddings || [];
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(
          `No embeddings found at ${embeddingsFile}. Generate embeddings first.`
        );
      }
      throw error;
    }
  }

  /**
   * Generate storage summary
   */
  private async generateStorageSummary(
    documentsStored: number,
    stats: any
  ): Promise<void> {
    const summary = {
      timestamp: new Date().toISOString(),
      qdrant: {
        url: this.config.qdrantUrl,
        collection: this.config.collectionName,
        documentsStored,
        totalDocuments: stats.totalDocuments,
        vectorSize: stats.vectorSize,
        distance: stats.distance,
      },
      performance: {
        healthCheck: true,
        realQdrantIntegration: true, // Real Qdrant client is now integrated
      },
      nextSteps: [
        'Implement semantic search in MCP server',
        'Add hybrid search capabilities',
        'Optimize vector retrieval performance',
        'Add advanced filtering and ranking',
      ],
    };

    const summaryPath = path.join(
      this.config.dataPath,
      'qdrant-storage-summary.json'
    );
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n📋 Storage summary saved to: ${summaryPath}`);
  }

  /**
   * Clean up Qdrant collection
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Qdrant collection...');

    try {
      await this.qdrantService.deleteCollection();
      console.log('✅ Qdrant collection deleted');
    } catch (error) {
      console.error(
        '❌ Cleanup failed:',
        error instanceof Error ? error.message : error
      );
    }
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
    stats: args.includes('--stats'),
    cleanup: args.includes('--cleanup'),
    help: args.includes('--help') || args.includes('-h'),
  };

  if (flags.help) {
    console.log(`
🔧 PrivMX Qdrant Storage Manager

Usage: tsx store-in-qdrant.ts [options]

Options:
  --force      Force storage even if Qdrant already contains data
  --test       Test search functionality after storage
  --stats      Show current statistics
  --cleanup    Delete the Qdrant collection
  --help       Show this help message

Environment Variables:
  QDRANT_URL       Qdrant server URL (default: http://localhost:6333)
  QDRANT_API_KEY   Qdrant API key (if authentication is enabled)
  OPENAI_API_KEY   Required for search testing

Examples:
  tsx store-in-qdrant.ts
  tsx store-in-qdrant.ts --force
  tsx store-in-qdrant.ts --test
  tsx store-in-qdrant.ts --stats
  tsx store-in-qdrant.ts --cleanup
`);
    return;
  }

  try {
    const manager = new QdrantStorageManager({
      force: flags.force,
    });

    if (flags.cleanup) {
      await manager.cleanup();
    } else if (flags.stats) {
      await manager.getStats();
    } else if (flags.test) {
      await manager.testSearch();
    } else {
      await manager.storeEmbeddings();

      if (flags.test) {
        await manager.testSearch();
      }
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

export { QdrantStorageManager };
