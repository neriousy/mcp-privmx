/**
 * Hybrid Chunking Strategy
 * Combines different approaches based on content type and characteristics
 */

import type {
  ParsedContent,
  DocumentChunk,
  ChunkingStrategy,
} from '@privmx/shared';
import { MethodLevelStrategy } from './method-level-strategy.js';
import { ContextAwareStrategy } from './context-aware-strategy.js';
import { HierarchicalStrategy } from './hierarchical-strategy.js';

export class HybridStrategy implements ChunkingStrategy {
  name = 'hybrid';

  private methodLevelStrategy: MethodLevelStrategy;
  private contextAwareStrategy: ContextAwareStrategy;
  private hierarchicalStrategy: HierarchicalStrategy;

  constructor() {
    this.methodLevelStrategy = new MethodLevelStrategy();
    this.contextAwareStrategy = new ContextAwareStrategy();
    this.hierarchicalStrategy = new HierarchicalStrategy();
  }

  /**
   * Determine if content should be split using hybrid approach
   */
  shouldSplit(content: ParsedContent): boolean {
    const strategy = this.selectOptimalStrategy(content);
    return strategy.shouldSplit(content);
  }

  /**
   * Split logic using optimal strategy for content type
   */
  splitLogic(content: ParsedContent): DocumentChunk[] {
    const strategy = this.selectOptimalStrategy(content);
    let chunks = strategy.splitLogic(content);

    // Apply post-processing optimizations
    chunks = this.postProcessChunks(chunks, content);

    return chunks;
  }

  /**
   * Select optimal strategy based on content characteristics
   */
  private selectOptimalStrategy(content: ParsedContent): ChunkingStrategy {
    const characteristics = this.analyzeContent(content);

    // For API methods, use method-level strategy
    if (content.type === 'method') {
      return this.methodLevelStrategy;
    }

    // For classes with many methods, use context-aware grouping
    if (content.type === 'class' && characteristics.methodCount > 5) {
      return this.contextAwareStrategy;
    }

    // For content with clear hierarchy, use hierarchical strategy
    if (characteristics.hasStrongHierarchy) {
      return this.hierarchicalStrategy;
    }

    // For tutorials and examples with multiple sections
    if (content.type === 'example' && characteristics.sectionCount > 3) {
      return this.contextAwareStrategy;
    }

    // For simple content, use method-level (which handles single chunks well)
    return this.methodLevelStrategy;
  }

  /**
   * Analyze content characteristics to guide strategy selection
   */
  private analyzeContent(content: ParsedContent): {
    methodCount: number;
    sectionCount: number;
    hasStrongHierarchy: boolean;
    contentLength: number;
    complexity: 'low' | 'medium' | 'high';
    primaryFocus: 'reference' | 'tutorial' | 'mixed';
  } {
    const contentText = content.content;

    // Count methods
    const methodMatches = contentText.match(
      /^(#{2,3})\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\([^)]*\)/gm
    );
    const methodCount = methodMatches ? methodMatches.length : 0;

    // Count sections
    const sectionMatches = contentText.match(/^#{1,6}\s+.+$/gm);
    const sectionCount = sectionMatches ? sectionMatches.length : 0;

    // Analyze hierarchy strength
    const h1Count = (contentText.match(/^#\s+/gm) || []).length;
    const h2Count = (contentText.match(/^#{2}\s+/gm) || []).length;
    const h3Count = (contentText.match(/^#{3}\s+/gm) || []).length;
    const hasStrongHierarchy =
      h1Count > 0 && h2Count > 1 && (h3Count > 0 || sectionCount > 5);

    // Determine complexity
    const contentLength = contentText.length;
    let complexity: 'low' | 'medium' | 'high' = 'low';

    if (contentLength > 3000 || methodCount > 8 || sectionCount > 6) {
      complexity = 'high';
    } else if (contentLength > 1500 || methodCount > 3 || sectionCount > 3) {
      complexity = 'medium';
    }

    // Determine primary focus
    let primaryFocus: 'reference' | 'tutorial' | 'mixed' = 'reference';
    const hasCodeExamples = contentText.includes('```');
    const hasStepByStep = /step \d+|first|then|next|finally/i.test(contentText);

    if (content.type === 'example' || hasStepByStep) {
      primaryFocus = 'tutorial';
    } else if (hasCodeExamples && methodCount > 0) {
      primaryFocus = 'mixed';
    }

    return {
      methodCount,
      sectionCount,
      hasStrongHierarchy,
      contentLength,
      complexity,
      primaryFocus,
    };
  }

  /**
   * Post-process chunks for optimization
   */
  private postProcessChunks(
    chunks: DocumentChunk[],
    originalContent: ParsedContent
  ): DocumentChunk[] {
    let processedChunks = [...chunks];

    // Add cross-references between related chunks
    processedChunks = this.addCrossReferences(processedChunks);

    // Ensure optimal chunk sizes
    processedChunks = this.optimizeChunkSizes(processedChunks);

    // Add hybrid-specific metadata
    processedChunks = this.enhanceMetadata(processedChunks, originalContent);

    return processedChunks;
  }

  /**
   * Add cross-references between related chunks
   */
  private addCrossReferences(chunks: DocumentChunk[]): DocumentChunk[] {
    return chunks.map((chunk) => {
      const relatedChunks = this.findRelatedChunks(chunk, chunks);

      if (relatedChunks.length > 0) {
        let enhancedContent = chunk.content;

        enhancedContent += '\n\n## Related Sections\n\n';
        for (const related of relatedChunks) {
          const title = this.extractTitle(related.content);
          enhancedContent += `- [${title}](#${related.id})\n`;
        }

        return {
          ...chunk,
          content: enhancedContent,
        };
      }

      return chunk;
    });
  }

  /**
   * Find chunks related to the given chunk
   */
  private findRelatedChunks(
    targetChunk: DocumentChunk,
    allChunks: DocumentChunk[]
  ): DocumentChunk[] {
    const related: DocumentChunk[] = [];
    const maxRelated = 3;

    for (const chunk of allChunks) {
      if (chunk.id === targetChunk.id) continue;

      const relevanceScore = this.calculateRelevanceScore(targetChunk, chunk);
      if (relevanceScore > 0.3) {
        related.push(chunk);
      }
    }

    // Sort by relevance and take top matches
    return related
      .sort(
        (a, b) =>
          this.calculateRelevanceScore(targetChunk, b) -
          this.calculateRelevanceScore(targetChunk, a)
      )
      .slice(0, maxRelated);
  }

  /**
   * Calculate relevance score between two chunks
   */
  private calculateRelevanceScore(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk
  ): number {
    let score = 0;

    // Same namespace bonus
    if (chunk1.metadata.namespace === chunk2.metadata.namespace) {
      score += 0.3;
    }

    // Same class bonus
    if (chunk1.metadata.className === chunk2.metadata.className) {
      score += 0.4;
    }

    // Related methods bonus
    const chunk1Methods = chunk1.metadata.relatedMethods || [];
    const chunk2Methods = chunk2.metadata.relatedMethods || [];
    const methodOverlap = chunk1Methods.filter((method) =>
      chunk2Methods.includes(method)
    ).length;
    if (methodOverlap > 0) {
      score += methodOverlap * 0.1;
    }

    // Tag similarity bonus
    const commonTags = chunk1.metadata.tags.filter((tag) =>
      chunk2.metadata.tags.includes(tag)
    );
    score += commonTags.length * 0.05;

    // Content similarity (basic word overlap)
    const words1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(chunk2.content.toLowerCase().split(/\s+/));
    const intersection = new Set(
      [...words1].filter((word) => words2.has(word))
    );
    const union = new Set([...words1, ...words2]);
    score += (intersection.size / union.size) * 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Extract title from chunk content
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#{1,6}\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Fallback to first line
    const firstLine = content.split('\n')[0];
    return (
      firstLine.substring(0, 50).trim() + (firstLine.length > 50 ? '...' : '')
    );
  }

  /**
   * Optimize chunk sizes
   */
  private optimizeChunkSizes(chunks: DocumentChunk[]): DocumentChunk[] {
    const minSize = 200;
    const maxSize = 2000;
    const optimized: DocumentChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // If chunk is too small, try to merge with next chunk
      if (chunk.content.length < minSize && i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const combinedLength = chunk.content.length + nextChunk.content.length;

        if (
          combinedLength <= maxSize &&
          this.canMergeChunks(chunk, nextChunk)
        ) {
          const mergedChunk = this.mergeChunks(chunk, nextChunk);
          optimized.push(mergedChunk);
          i++; // Skip next chunk as it's been merged
          continue;
        }
      }

      // If chunk is too large, split it
      if (chunk.content.length > maxSize) {
        const splitChunks = this.splitLargeChunk(chunk, maxSize);
        optimized.push(...splitChunks);
        continue;
      }

      optimized.push(chunk);
    }

    return optimized;
  }

  /**
   * Check if two chunks can be merged
   */
  private canMergeChunks(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk
  ): boolean {
    // Same namespace and class
    return (
      chunk1.metadata.namespace === chunk2.metadata.namespace &&
      chunk1.metadata.className === chunk2.metadata.className
    );
  }

  /**
   * Merge two chunks
   */
  private mergeChunks(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk
  ): DocumentChunk {
    const mergedContent = chunk1.content + '\n\n---\n\n' + chunk2.content;

    return {
      id: `${chunk1.id}-merged`,
      content: mergedContent,
      metadata: {
        ...chunk1.metadata,
        tags: [...new Set([...chunk1.metadata.tags, ...chunk2.metadata.tags])],
        relatedMethods: [
          ...new Set([
            ...(chunk1.metadata.relatedMethods || []),
            ...(chunk2.metadata.relatedMethods || []),
          ]),
        ],
      },
    };
  }

  /**
   * Split large chunk into smaller ones
   */
  private splitLargeChunk(
    chunk: DocumentChunk,
    maxSize: number
  ): DocumentChunk[] {
    const content = chunk.content;
    const chunks: DocumentChunk[] = [];

    // Try to split at section boundaries
    const sections = content.split(/^#{1,6}\s+/m);

    if (sections.length > 1) {
      // Split by sections
      let currentChunk = sections[0];
      let chunkIndex = 0;

      for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        const potentialChunk = currentChunk + section;

        if (potentialChunk.length <= maxSize) {
          currentChunk = potentialChunk;
        } else {
          // Create chunk and start new one
          if (currentChunk.trim()) {
            chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex++));
          }
          currentChunk = section;
        }
      }

      // Add final chunk
      if (currentChunk.trim()) {
        chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex));
      }
    } else {
      // Split by paragraphs if no sections
      const paragraphs = content.split(/\n\s*\n/);
      let currentChunk = '';
      let chunkIndex = 0;

      for (const paragraph of paragraphs) {
        const potentialChunk =
          currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

        if (potentialChunk.length <= maxSize) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk.trim()) {
            chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex++));
          }
          currentChunk = paragraph;
        }
      }

      if (currentChunk.trim()) {
        chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex));
      }
    }

    return chunks.length > 0 ? chunks : [chunk];
  }

  /**
   * Create sub-chunk from parent
   */
  private createSubChunk(
    parent: DocumentChunk,
    content: string,
    index: number
  ): DocumentChunk {
    return {
      id: `${parent.id}-part-${index}`,
      content,
      metadata: {
        ...parent.metadata,
        tags: [...parent.metadata.tags, 'sub-chunk', `part-${index}`],
      },
    };
  }

  /**
   * Enhance metadata with hybrid-specific information
   */
  private enhanceMetadata(
    chunks: DocumentChunk[],
    originalContent: ParsedContent
  ): DocumentChunk[] {
    const characteristics = this.analyzeContent(originalContent);

    return chunks.map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        tags: [
          ...chunk.metadata.tags,
          'hybrid-chunked',
          `complexity-${characteristics.complexity}`,
          `focus-${characteristics.primaryFocus}`,
        ],
      },
    }));
  }
}
