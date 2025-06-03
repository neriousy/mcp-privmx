#!/usr/bin/env node

/**
 * Generate Embeddings Script
 *
 * Generates OpenAI embeddings for all processed document chunks
 * and stores them with metadata for vector database ingestion.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { EmbeddingsService } from '../embeddings/embeddings-service.js';
import type { DocumentChunk } from '@privmx/shared';

interface EmbeddingData {
  chunkId: string;
  embedding: number[];
  metadata: {
    model: string;
    tokens: number;
    timestamp: string;
    processingTime: number;
  };
}

interface EmbeddingOutput {
  timestamp: string;
  totalChunks: number;
  totalEmbeddings: number;
  totalTokens: number;
  processingTime: number;
  model: string;
  embeddings: EmbeddingData[];
  errors: Array<{
    chunkId: string;
    error: string;
  }>;
}

/**
 * Main embedding generation function
 */
async function generateEmbeddings(): Promise<void> {
  const startTime = Date.now();
  console.log('🧠 Starting embedding generation process...');

  // Check for test mode
  const isTestMode = process.argv.includes('--test');
  if (isTestMode) {
    console.log('🧪 Running in test mode - processing first 5 chunks only');
  }

  try {
    // Load processed chunks
    const dataPath = join(process.cwd(), '../../data');
    const chunksFile = join(dataPath, 'processed-chunks.json');

    console.log(`📂 Loading chunks from: ${chunksFile}`);
    const chunksData = JSON.parse(await readFile(chunksFile, 'utf-8'));
    let chunks: DocumentChunk[] = chunksData.chunks || [];

    if (!chunks.length) {
      throw new Error('No chunks found. Run index-docs script first.');
    }

    // Limit chunks in test mode
    if (isTestMode) {
      chunks = chunks.slice(0, 5);
    }

    console.log(
      `📊 Processing ${chunks.length} chunks for embedding generation`
    );

    // Initialize embeddings service
    const embeddingsService = new EmbeddingsService({
      model: 'text-embedding-3-small',
      maxTokens: 8191,
      batchSize: isTestMode ? 2 : 100,
      retryAttempts: 3,
      retryDelay: 1000,
    });

    console.log(
      `⚙️  Configuration: ${embeddingsService.getConfig().model} (${embeddingsService.getConfig().dimensions}D)`
    );

    // Generate embeddings
    const result = await embeddingsService.generateEmbeddings(chunks);

    // Prepare output data
    const outputData: EmbeddingOutput = {
      timestamp: new Date().toISOString(),
      totalChunks: chunks.length,
      totalEmbeddings: result.results.length,
      totalTokens: result.totalTokens,
      processingTime: result.processingTime,
      model: embeddingsService.getConfig().model,
      embeddings: result.results,
      errors: result.errors,
    };

    // Save embeddings to file
    const outputFile = join(
      dataPath,
      isTestMode ? 'test-embeddings.json' : 'embeddings.json'
    );
    await writeFile(outputFile, JSON.stringify(outputData, null, 2));

    const totalTime = Date.now() - startTime;

    // Print summary
    console.log('\n🎉 Embedding generation completed!');
    console.log('📊 Summary:');
    console.log(`  • Total chunks processed: ${chunks.length}`);
    console.log(`  • Successful embeddings: ${result.results.length}`);
    console.log(`  • Failed chunks: ${result.errors.length}`);
    console.log(
      `  • Total tokens used: ${result.totalTokens.toLocaleString()}`
    );
    console.log(`  • Processing time: ${result.processingTime}ms`);
    console.log(`  • Total time: ${totalTime}ms`);
    console.log(
      `  • Average time per chunk: ${Math.round(totalTime / chunks.length)}ms`
    );

    // Cost estimation (rough)
    const estimatedCost = (result.totalTokens / 1000000) * 0.02; // $0.02 per 1M tokens for text-embedding-3-small
    console.log(`  • Estimated cost: $${estimatedCost.toFixed(4)}`);

    console.log(`💾 Embeddings saved to: ${outputFile}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach((error) => {
        console.log(`  • ${error.chunkId}: ${error.error}`);
      });
    }

    // Next steps
    console.log('\n📋 Next steps:');
    console.log('  1. Run store-in-qdrant script to upload to vector database');
    console.log('  2. Test semantic search functionality');
    console.log('  3. Start MCP server with vector search enabled');
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    process.exit(1);
  }
}

/**
 * Validate environment and dependencies
 */
async function validateEnvironment(): Promise<void> {
  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY environment variable is required. ' +
        'Set it with: export OPENAI_API_KEY="your-api-key"'
    );
  }

  // Check if chunks file exists
  const dataPath = join(process.cwd(), '../../data');
  const chunksFile = join(dataPath, 'processed-chunks.json');

  try {
    await readFile(chunksFile);
  } catch (error) {
    throw new Error(
      `Processed chunks file not found: ${chunksFile}\n` +
        'Run the index-docs script first to generate document chunks.'
    );
  }
}

/**
 * Display usage information
 */
function displayUsage(): void {
  console.log('📖 Usage:');
  console.log(
    '  pnpm run generate-embeddings     # Generate embeddings for all chunks'
  );
  console.log(
    '  pnpm run generate-embeddings --test  # Test mode (first 5 chunks only)'
  );
  console.log('');
  console.log('📋 Prerequisites:');
  console.log('  • Set OPENAI_API_KEY environment variable');
  console.log('  • Run index-docs script first to generate chunks');
  console.log('');
  console.log('💡 Examples:');
  console.log('  export OPENAI_API_KEY="sk-..."');
  console.log('  pnpm run index-docs');
  console.log('  pnpm run generate-embeddings');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  // Handle help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayUsage();
    return;
  }

  try {
    await validateEnvironment();
    await generateEmbeddings();
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.log('');
    displayUsage();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
