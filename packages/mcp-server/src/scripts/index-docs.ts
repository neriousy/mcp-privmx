#!/usr/bin/env node

/**
 * Documentation Indexing Script
 * 
 * Processes PrivMX documentation files and prepares them for the MCP server.
 * This script will be expanded in Phase 4-5 to include embedding generation
 * and vector database storage.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSONParser } from '../parsers/json-parser.js';
import { MDXParser } from '../parsers/mdx-parser.js';
import { ChunkingManager } from '../chunking/chunking-manager.js';
import type { ParsedContent } from '@privmx/shared';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration for the indexing process
 */
interface IndexingConfig {
  specDir: string;
  outputDir: string;
  chunkingStrategy: 'method-level' | 'context-aware' | 'hierarchical' | 'hybrid';
  maxChunkSize: number;
  overlapSize: number;
}

const DEFAULT_CONFIG: IndexingConfig = {
  specDir: path.join(__dirname, '../../../../spec'),
  outputDir: path.join(__dirname, '../../../../data'),
  chunkingStrategy: 'hybrid',
  maxChunkSize: 1500,
  overlapSize: 200,
};

/**
 * Main indexing class
 */
class DocumentationIndexer {
  private config: IndexingConfig;
  private jsonParser: JSONParser;
  private mdxParser: MDXParser;
  private chunkingManager: ChunkingManager;

  constructor(config: Partial<IndexingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.jsonParser = new JSONParser();
    this.mdxParser = new MDXParser();
    this.chunkingManager = new ChunkingManager();
  }

  /**
   * Main indexing process
   */
  async index(): Promise<void> {
    console.log('📚 Starting documentation indexing process...\n');

    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      // Parse JSON API documentation
      const jsonContent = await this.parseJSONDocumentation();
      console.log(`✅ Parsed ${jsonContent.length} JSON API items`);

      // Parse MDX tutorials
      const mdxContent = await this.parseMDXDocumentation();
      console.log(`✅ Parsed ${mdxContent.length} MDX tutorial items`);

      // Combine all content
      const allContent = [...jsonContent, ...mdxContent];
      console.log(`📄 Total content items: ${allContent.length}`);

      // Process chunks
      const chunkingResult = await this.chunkingManager.processContent(allContent, {
        strategy: this.config.chunkingStrategy,
        maxChunkSize: this.config.maxChunkSize,
        overlapSize: this.config.overlapSize,
        enhanceContent: true,
        optimizeChunks: true,
        validateOutput: true,
      });

      console.log(`✅ Generated ${chunkingResult.chunks.length} chunks`);
      console.log(`⏱️  Processing time: ${chunkingResult.metadata.processingTime}ms`);

      // Save processed chunks
      await this.saveProcessedChunks(chunkingResult.chunks);

      // Generate summary
      await this.generateIndexingSummary(chunkingResult);

      console.log('\n🎉 Documentation indexing completed successfully!');
      console.log(`📊 Results saved to: ${this.config.outputDir}`);

    } catch (error) {
      console.error('❌ Indexing failed:', error);
      throw error;
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.config.outputDir}`);
    }
  }

  /**
   * Parse JSON API documentation
   */
  private async parseJSONDocumentation(): Promise<ParsedContent[]> {
    const jsonFilePath = path.join(this.config.specDir, 'out.js.json');
    
    try {
      await fs.access(jsonFilePath);
    } catch {
      console.warn(`⚠️  JSON documentation not found at: ${jsonFilePath}`);
      return [];
    }

    console.log('📖 Processing JSON API documentation...');
    const content = await fs.readFile(jsonFilePath, 'utf-8');
    return await this.jsonParser.parseSpec(content);
  }

  /**
   * Parse MDX tutorials
   */
  private async parseMDXDocumentation(): Promise<ParsedContent[]> {
    const mdxDir = path.join(this.config.specDir, 'mdx');
    
    try {
      await fs.access(mdxDir);
    } catch {
      console.warn(`⚠️  MDX documentation directory not found at: ${mdxDir}`);
      return [];
    }

    console.log('📖 Processing MDX tutorials...');
    const allContent: ParsedContent[] = [];
    
    const files = await fs.readdir(mdxDir);
    const mdxFiles = files.filter(file => file.endsWith('.mdx'));

    for (const file of mdxFiles) {
      const filePath = path.join(mdxDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = await this.mdxParser.parseFile(content, file);
        allContent.push(...result);
        console.log(`  ✅ Processed ${file}: ${result.length} items`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to process ${file}:`, error);
      }
    }

    return allContent;
  }

  /**
   * Save processed chunks to disk
   */
  private async saveProcessedChunks(chunks: any[]): Promise<void> {
    const chunksFile = path.join(this.config.outputDir, 'processed-chunks.json');
    
    const chunksData = {
      timestamp: new Date().toISOString(),
      totalChunks: chunks.length,
      chunks: chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        // Note: embeddings will be added in Phase 4
      })),
    };

    await fs.writeFile(chunksFile, JSON.stringify(chunksData, null, 2));
    console.log(`💾 Saved ${chunks.length} chunks to ${chunksFile}`);
  }

  /**
   * Generate indexing summary
   */
  private async generateIndexingSummary(result: any): Promise<void> {
    const summaryFile = path.join(this.config.outputDir, 'indexing-summary.json');
    
    const stats = this.chunkingManager.getChunkStatistics(result.chunks);
    
    const summary = {
      indexingDate: new Date().toISOString(),
      configuration: this.config,
      processingMetadata: result.metadata,
      chunkStatistics: stats,
      validationResults: result.validation,
      nextSteps: [
        'Phase 4: Generate embeddings using OpenAI API',
        'Phase 5: Store chunks in vector database (ChromaDB)',
        'Phase 6: Implement semantic search functionality',
      ],
    };

    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📋 Generated indexing summary: ${summaryFile}`);
  }

  /**
   * Display statistics
   */
  displayStatistics(result: any): void {
    console.log('\n📊 Indexing Statistics:');
    console.log(`  Total input items: ${result.metadata.totalInputItems}`);
    console.log(`  Total output chunks: ${result.metadata.totalOutputChunks}`);
    console.log(`  Average chunk size: ${result.metadata.averageChunkSize} chars`);
    console.log(`  Processing time: ${result.metadata.processingTime}ms`);
    console.log(`  Strategy used: ${result.metadata.strategy}`);
    
    if (result.validation) {
      console.log(`  Validation: ${result.validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
      if (result.validation.errors.length > 0) {
        console.log(`  Errors: ${result.validation.errors.length}`);
      }
      if (result.validation.warnings.length > 0) {
        console.log(`  Warnings: ${result.validation.warnings.length}`);
      }
    }
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceReindex = args.includes('--force') || args.includes('-f');
  const strategy = args.find(arg => arg.startsWith('--strategy='))?.split('=')[1] as any;

  const config: Partial<IndexingConfig> = {};
  if (strategy) {
    config.chunkingStrategy = strategy;
  }

  const indexer = new DocumentationIndexer(config);

  if (forceReindex) {
    console.log('🔄 Force re-indexing enabled');
  }

  try {
    await indexer.index();
  } catch (error) {
    console.error('❌ Indexing failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DocumentationIndexer }; 