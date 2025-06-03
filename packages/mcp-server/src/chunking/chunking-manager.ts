/**
 * Chunking Manager
 * Orchestrates different chunking strategies and manages the chunking process
 */

import type {
  ParsedContent,
  DocumentChunk,
  ChunkingStrategy,
  ChunkMetadata,
} from '@privmx/shared';
// import { ContentValidator } from '../parsers/content-validator.js';
import { ChunkEnhancer } from './chunk-enhancer.js';
import { ChunkOptimizer } from './chunk-optimizer.js';
import { MethodLevelStrategy } from './strategies/method-level-strategy.js';
import { ContextAwareStrategy } from './strategies/context-aware-strategy.js';
import { HierarchicalStrategy } from './strategies/hierarchical-strategy.js';
import { HybridStrategy } from './strategies/hybrid-strategy.js';

export interface ChunkingResult {
  chunks: DocumentChunk[];
  metadata: {
    totalInputItems: number;
    totalOutputChunks: number;
    averageChunkSize: number;
    processingTime: number;
    strategy: string;
  };
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface ChunkingOptions {
  strategy: 'method-level' | 'context-aware' | 'hierarchical' | 'hybrid';
  maxChunkSize: number;
  overlapSize: number;
  enhanceContent: boolean;
  optimizeChunks: boolean;
  validateOutput: boolean;
}

export class ChunkingManager {
  private strategies: Map<string, ChunkingStrategy>;
  private enhancer: ChunkEnhancer;
  private optimizer: ChunkOptimizer;

  constructor() {
    this.strategies = new Map();
    this.enhancer = new ChunkEnhancer();
    this.optimizer = new ChunkOptimizer();
    this.initializeStrategies();
  }

  /**
   * Process parsed content into optimized chunks
   */
  async processContent(
    content: ParsedContent[],
    options: ChunkingOptions
  ): Promise<ChunkingResult> {
    const startTime = process.hrtime.bigint();

    try {
      // Get chunking strategy
      const strategy = this.strategies.get(options.strategy);
      if (!strategy) {
        throw new Error(`Unknown chunking strategy: ${options.strategy}`);
      }

      // Generate initial chunks
      let chunks = await this.generateChunks(content, strategy);

      // Enhance chunks if requested
      if (options.enhanceContent) {
        chunks = await this.enhanceChunks(chunks);
      }

      // Optimize chunks if requested
      if (options.optimizeChunks) {
        chunks = await this.optimizeChunks(chunks, options);
      }

      // Validate output if requested
      let validation: {
        isValid: boolean;
        errors: string[];
        warnings: string[];
      } = { isValid: true, errors: [], warnings: [] };
      if (options.validateOutput) {
        validation = this.validateChunks(chunks);
      }

      const endTime = process.hrtime.bigint();
      const processingTime = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds

      return {
        chunks,
        metadata: {
          totalInputItems: content.length,
          totalOutputChunks: chunks.length,
          averageChunkSize: this.calculateAverageChunkSize(chunks),
          processingTime,
          strategy: options.strategy,
        },
        validation,
      };
    } catch (error) {
      throw new Error(`Chunking failed: ${error}`);
    }
  }

  /**
   * Generate chunks using selected strategy
   */
  private async generateChunks(
    content: ParsedContent[],
    strategy: ChunkingStrategy
  ): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];

    for (const item of content) {
      if (strategy.shouldSplit(item)) {
        const itemChunks = strategy.splitLogic(item);
        allChunks.push(...itemChunks);
      } else {
        // Create single chunk from the entire item
        const chunk = this.createChunkFromContent(item);
        allChunks.push(chunk);
      }
    }

    return allChunks;
  }

  /**
   * Create a DocumentChunk from ParsedContent
   */
  private createChunkFromContent(content: ParsedContent): DocumentChunk {
    const chunkId = this.generateChunkId(content);

    return {
      id: chunkId,
      content: this.buildChunkContent(content),
      metadata: {
        ...content.metadata,
        // Ensure metadata is properly typed
        type: content.metadata.type,
        namespace: content.metadata.namespace,
        importance: content.metadata.importance,
        tags: content.metadata.tags,
        sourceFile: content.metadata.sourceFile,
      },
    };
  }

  /**
   * Build enhanced content for a chunk
   */
  private buildChunkContent(content: ParsedContent): string {
    let chunkContent = `# ${content.name}\n\n`;
    chunkContent += `${content.description}\n\n`;
    chunkContent += content.content;

    // Add examples if available
    if (content.examples && content.examples.length > 0) {
      chunkContent += '\n\n## Examples\n\n';
      content.examples.forEach((example, index) => {
        chunkContent += `### Example ${index + 1}${example.title ? `: ${example.title}` : ''}\n\n`;
        chunkContent += `${example.explanation}\n\n`;
        chunkContent += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
      });
    }

    // Add parameters if available
    if (content.parameters && content.parameters.length > 0) {
      chunkContent += '\n\n## Parameters\n\n';
      content.parameters.forEach((param) => {
        chunkContent += `- **${param.name}** (${param.type.name}${param.type.optional ? '?' : ''}): ${param.description}\n`;
      });
    }

    // Add return values if available
    if (content.returns && content.returns.length > 0) {
      chunkContent += '\n\n## Returns\n\n';
      content.returns.forEach((returnValue) => {
        chunkContent += `- **${returnValue.type.name}**: ${returnValue.description}\n`;
      });
    }

    return chunkContent;
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(content: ParsedContent): string {
    const namespace = content.metadata.namespace || 'general';
    const type = content.metadata.type;
    const name = content.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = Date.now().toString(36);

    return `${namespace}-${type}-${name}-${timestamp}`;
  }

  /**
   * Enhance chunks with additional context
   */
  private async enhanceChunks(
    chunks: DocumentChunk[]
  ): Promise<DocumentChunk[]> {
    return Promise.all(chunks.map((chunk) => this.enhancer.enhance(chunk)));
  }

  /**
   * Optimize chunks for better retrieval
   */
  private async optimizeChunks(
    chunks: DocumentChunk[],
    options: ChunkingOptions
  ): Promise<DocumentChunk[]> {
    return this.optimizer.optimize(chunks, {
      maxChunkSize: options.maxChunkSize,
      overlapSize: options.overlapSize,
      deduplication: true,
      qualityScoring: true,
    });
  }

  /**
   * Validate generated chunks
   */
  private validateChunks(chunks: DocumentChunk[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    // Simple validation for chunks
    const errors: string[] = [];
    const warnings: string[] = [];

    chunks.forEach((chunk, index) => {
      if (!chunk.id) {
        errors.push(`Chunk ${index}: Missing ID`);
      }
      if (!chunk.content || chunk.content.trim().length === 0) {
        errors.push(`Chunk ${index}: Empty content`);
      }
      if (chunk.content.length > 5000) {
        warnings.push(
          `Chunk ${index}: Very large content (${chunk.content.length} chars)`
        );
      }
      if (chunk.content.length < 50) {
        warnings.push(
          `Chunk ${index}: Very small content (${chunk.content.length} chars)`
        );
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Calculate average chunk size in characters
   */
  private calculateAverageChunkSize(chunks: DocumentChunk[]): number {
    if (chunks.length === 0) return 0;

    const totalSize = chunks.reduce(
      (sum, chunk) => sum + chunk.content.length,
      0
    );
    return Math.round(totalSize / chunks.length);
  }

  /**
   * Initialize chunking strategies
   */
  private initializeStrategies(): void {
    // Register all available chunking strategies
    this.strategies.set('method-level', new MethodLevelStrategy());
    this.strategies.set('context-aware', new ContextAwareStrategy());
    this.strategies.set('hierarchical', new HierarchicalStrategy());
    this.strategies.set('hybrid', new HybridStrategy());
  }

  /**
   * Register a new chunking strategy
   */
  registerStrategy(name: string, strategy: ChunkingStrategy): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Get available strategy names
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get chunk statistics
   */
  getChunkStatistics(chunks: DocumentChunk[]): {
    totalChunks: number;
    averageSize: number;
    sizeDistribution: Record<string, number>;
    typeDistribution: Record<string, number>;
    namespaceDistribution: Record<string, number>;
  } {
    const stats = {
      totalChunks: chunks.length,
      averageSize: this.calculateAverageChunkSize(chunks),
      sizeDistribution: {} as Record<string, number>,
      typeDistribution: {} as Record<string, number>,
      namespaceDistribution: {} as Record<string, number>,
    };

    // Calculate size distribution
    const sizeRanges = ['0-500', '501-1000', '1001-1500', '1501-2000', '2000+'];
    sizeRanges.forEach((range) => (stats.sizeDistribution[range] = 0));

    chunks.forEach((chunk) => {
      const size = chunk.content.length;
      if (size <= 500) stats.sizeDistribution['0-500']++;
      else if (size <= 1000) stats.sizeDistribution['501-1000']++;
      else if (size <= 1500) stats.sizeDistribution['1001-1500']++;
      else if (size <= 2000) stats.sizeDistribution['1501-2000']++;
      else stats.sizeDistribution['2000+']++;

      // Type distribution
      const type = chunk.metadata.type;
      stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + 1;

      // Namespace distribution
      const namespace = chunk.metadata.namespace;
      stats.namespaceDistribution[namespace] =
        (stats.namespaceDistribution[namespace] || 0) + 1;
    });

    return stats;
  }
}
