/**
 * Chunk Optimizer
 * Optimizes document chunks for better retrieval and quality
 */

import type { DocumentChunk, ChunkMetadata } from '@privmx/shared';

export interface OptimizationOptions {
  maxChunkSize: number;
  overlapSize: number;
  deduplication: boolean;
  qualityScoring: boolean;
  mergeRelated: boolean;
  splitOversized: boolean;
}

export interface ChunkQualityScore {
  overall: number;
  completeness: number;
  specificity: number;
  usefulness: number;
  clarity: number;
}

export class ChunkOptimizer {
  private defaultOptions: OptimizationOptions = {
    maxChunkSize: 1500,
    overlapSize: 200,
    deduplication: true,
    qualityScoring: true,
    mergeRelated: true,
    splitOversized: true,
  };

  /**
   * Optimize chunks for better retrieval and quality
   */
  async optimize(
    chunks: DocumentChunk[],
    options: Partial<OptimizationOptions> = {}
  ): Promise<DocumentChunk[]> {
    const opts = { ...this.defaultOptions, ...options };
    let optimizedChunks = [...chunks];

    // 1. Remove duplicates
    if (opts.deduplication) {
      optimizedChunks = this.removeDuplicates(optimizedChunks);
    }

    // 2. Split oversized chunks
    if (opts.splitOversized) {
      optimizedChunks = await this.splitOversizedChunks(optimizedChunks, opts);
    }

    // 3. Merge related small chunks
    if (opts.mergeRelated) {
      optimizedChunks = await this.mergeRelatedChunks(optimizedChunks, opts);
    }

    // 4. Score chunks for quality
    if (opts.qualityScoring) {
      optimizedChunks = this.scoreChunkQuality(optimizedChunks);
    }

    // 5. Sort by importance and quality
    optimizedChunks = this.sortChunksByPriority(optimizedChunks);

    return optimizedChunks;
  }

  /**
   * Remove duplicate chunks based on content similarity
   */
  private removeDuplicates(chunks: DocumentChunk[]): DocumentChunk[] {
    const uniqueChunks: DocumentChunk[] = [];
    const seenContent = new Set<string>();

    for (const chunk of chunks) {
      const contentHash = this.generateContentHash(chunk.content);
      const similarityThreshold = 0.9;

      // Check if we already have similar content
      let isDuplicate = false;
      for (const existingChunk of uniqueChunks) {
        const existingHash = this.generateContentHash(existingChunk.content);
        const similarity = this.calculateContentSimilarity(
          chunk.content,
          existingChunk.content
        );

        if (similarity > similarityThreshold || contentHash === existingHash) {
          isDuplicate = true;
          // Keep the chunk with higher importance
          if (
            this.getImportanceScore(chunk.metadata.importance) >
            this.getImportanceScore(existingChunk.metadata.importance)
          ) {
            // Replace existing with current chunk
            const index = uniqueChunks.indexOf(existingChunk);
            uniqueChunks[index] = chunk;
          }
          break;
        }
      }

      if (!isDuplicate) {
        uniqueChunks.push(chunk);
        seenContent.add(contentHash);
      }
    }

    return uniqueChunks;
  }

  /**
   * Split chunks that exceed maximum size
   */
  private async splitOversizedChunks(
    chunks: DocumentChunk[],
    options: OptimizationOptions
  ): Promise<DocumentChunk[]> {
    const result: DocumentChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length <= options.maxChunkSize) {
        result.push(chunk);
        continue;
      }

      // Split oversized chunk
      const splitChunks = this.splitChunk(chunk, options);
      result.push(...splitChunks);
    }

    return result;
  }

  /**
   * Merge related small chunks to improve context
   */
  private async mergeRelatedChunks(
    chunks: DocumentChunk[],
    options: OptimizationOptions
  ): Promise<DocumentChunk[]> {
    const result: DocumentChunk[] = [];
    const processed = new Set<string>();

    for (const chunk of chunks) {
      if (processed.has(chunk.id)) continue;

      // Find related chunks to merge
      const relatedChunks = this.findRelatedChunks(chunk, chunks);
      const candidatesForMerge = relatedChunks.filter(
        (related) =>
          !processed.has(related.id) &&
          this.canMergeChunks(chunk, related, options)
      );

      if (candidatesForMerge.length > 0) {
        const mergedChunk = this.mergeChunks([chunk, ...candidatesForMerge]);
        result.push(mergedChunk);

        // Mark all merged chunks as processed
        processed.add(chunk.id);
        candidatesForMerge.forEach((c) => processed.add(c.id));
      } else {
        result.push(chunk);
        processed.add(chunk.id);
      }
    }

    return result;
  }

  /**
   * Split a large chunk into smaller ones
   */
  private splitChunk(
    chunk: DocumentChunk,
    options: OptimizationOptions
  ): DocumentChunk[] {
    const { maxChunkSize, overlapSize } = options;
    const content = chunk.content;
    const chunks: DocumentChunk[] = [];

    // Split by logical boundaries (sections, paragraphs)
    const sections = this.splitByLogicalBoundaries(content);
    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const potentialChunk =
        currentChunk + (currentChunk ? '\n\n' : '') + section;

      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Create chunk from current content
        if (currentChunk) {
          chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex++));
        }

        // Start new chunk with overlap
        const overlap = this.extractOverlap(currentChunk, overlapSize);
        currentChunk = overlap + section;

        // If single section is too large, split it further
        if (currentChunk.length > maxChunkSize) {
          const largeSectionChunks = this.splitLargeSection(
            chunk,
            currentChunk,
            maxChunkSize,
            overlapSize,
            chunkIndex
          );
          chunks.push(...largeSectionChunks);
          chunkIndex += largeSectionChunks.length;
          currentChunk = '';
        }
      }
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createSubChunk(chunk, currentChunk, chunkIndex));
    }

    return chunks.length > 0 ? chunks : [chunk];
  }

  /**
   * Split content by logical boundaries
   */
  private splitByLogicalBoundaries(content: string): string[] {
    // Split by headers first
    const headerPattern = /^#{1,6}\s+.+$/gm;
    const sections: string[] = [];
    let lastIndex = 0;

    const matches = Array.from(content.matchAll(headerPattern));

    for (const match of matches) {
      if (match.index !== undefined && match.index > lastIndex) {
        const section = content.slice(lastIndex, match.index).trim();
        if (section) sections.push(section);
        lastIndex = match.index;
      }
    }

    // Add remaining content
    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) sections.push(remaining);
    }

    // If no headers found, split by paragraphs
    if (sections.length <= 1) {
      return content.split(/\n\s*\n/).filter((p) => p.trim());
    }

    return sections;
  }

  /**
   * Create a sub-chunk from a parent chunk
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
      embedding: parent.embedding, // Will need re-embedding
    };
  }

  /**
   * Extract overlap content from the end of a chunk
   */
  private extractOverlap(content: string, overlapSize: number): string {
    if (content.length <= overlapSize) return content;

    const overlap = content.slice(-overlapSize);
    // Try to end at a sentence boundary
    const sentenceEnd = overlap.lastIndexOf('. ');
    if (sentenceEnd > overlapSize / 2) {
      return overlap.slice(sentenceEnd + 2);
    }

    return overlap;
  }

  /**
   * Split a large section that exceeds max size
   */
  private splitLargeSection(
    parent: DocumentChunk,
    section: string,
    maxSize: number,
    overlapSize: number,
    startIndex: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let remaining = section;
    let index = startIndex;

    while (remaining.length > maxSize) {
      let splitPoint = maxSize;

      // Find a good split point (sentence or paragraph boundary)
      const sentenceEnd = remaining.lastIndexOf('. ', maxSize);
      const paragraphEnd = remaining.lastIndexOf('\n', maxSize);

      if (sentenceEnd > maxSize / 2) {
        splitPoint = sentenceEnd + 1;
      } else if (paragraphEnd > maxSize / 2) {
        splitPoint = paragraphEnd;
      }

      const chunkContent = remaining.slice(0, splitPoint).trim();
      chunks.push(this.createSubChunk(parent, chunkContent, index++));

      // Prepare next chunk with overlap
      const overlap = this.extractOverlap(chunkContent, overlapSize);
      remaining = overlap + remaining.slice(splitPoint).trim();
    }

    // Add final piece
    if (remaining.trim()) {
      chunks.push(this.createSubChunk(parent, remaining.trim(), index));
    }

    return chunks;
  }

  /**
   * Find chunks related to the given chunk
   */
  private findRelatedChunks(
    target: DocumentChunk,
    allChunks: DocumentChunk[]
  ): DocumentChunk[] {
    return allChunks.filter((chunk) => {
      if (chunk.id === target.id) return false;

      const metadata = chunk.metadata;
      const targetMetadata = target.metadata;

      // Same namespace and class
      if (
        metadata.namespace === targetMetadata.namespace &&
        metadata.className === targetMetadata.className
      ) {
        return true;
      }

      // Related methods
      if (
        targetMetadata.relatedMethods?.includes(
          `${metadata.className}.${metadata.methodName}`
        ) ||
        metadata.relatedMethods?.includes(
          `${targetMetadata.className}.${targetMetadata.methodName}`
        )
      ) {
        return true;
      }

      // Similar tags
      const commonTags = metadata.tags.filter((tag) =>
        targetMetadata.tags.includes(tag)
      );
      if (commonTags.length >= 2) {
        return true;
      }

      return false;
    });
  }

  /**
   * Check if two chunks can be merged
   */
  private canMergeChunks(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk,
    options: OptimizationOptions
  ): boolean {
    const combinedLength = chunk1.content.length + chunk2.content.length;

    // Don't merge if result would be too large
    if (combinedLength > options.maxChunkSize) {
      return false;
    }

    // Only merge if both are small
    const sizeThreshold = options.maxChunkSize * 0.6;
    if (
      chunk1.content.length > sizeThreshold ||
      chunk2.content.length > sizeThreshold
    ) {
      return false;
    }

    // Check if they're semantically related
    return this.areChunksSemanticallySimilar(chunk1, chunk2);
  }

  /**
   * Merge multiple chunks into one
   */
  private mergeChunks(chunks: DocumentChunk[]): DocumentChunk {
    const primaryChunk = chunks[0];
    const combinedContent = chunks.map((c) => c.content).join('\n\n---\n\n');

    // Merge metadata
    const allTags = new Set<string>();
    const allRelatedMethods = new Set<string>();
    const allDependencies = new Set<string>();
    const allUseCases = new Set<string>();
    const allCommonMistakes = new Set<string>();

    chunks.forEach((chunk) => {
      chunk.metadata.tags.forEach((tag) => allTags.add(tag));
      chunk.metadata.relatedMethods?.forEach((method) =>
        allRelatedMethods.add(method)
      );
      chunk.metadata.dependencies?.forEach((dep) => allDependencies.add(dep));
      chunk.metadata.useCases?.forEach((useCase) => allUseCases.add(useCase));
      chunk.metadata.commonMistakes?.forEach((mistake) =>
        allCommonMistakes.add(mistake)
      );
    });

    return {
      id: `merged-${primaryChunk.id}-${chunks.length}`,
      content: combinedContent,
      metadata: {
        ...primaryChunk.metadata,
        tags: Array.from(allTags),
        relatedMethods: Array.from(allRelatedMethods),
        dependencies: Array.from(allDependencies),
        useCases: Array.from(allUseCases),
        commonMistakes: Array.from(allCommonMistakes),
      },
    };
  }

  /**
   * Score chunk quality
   */
  private scoreChunkQuality(chunks: DocumentChunk[]): DocumentChunk[] {
    return chunks.map((chunk) => {
      const score = this.calculateQualityScore(chunk);

      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          tags: [...chunk.metadata.tags, `quality:${score.overall.toFixed(2)}`],
        },
      };
    });
  }

  /**
   * Calculate quality score for a chunk
   */
  private calculateQualityScore(chunk: DocumentChunk): ChunkQualityScore {
    const content = chunk.content;
    const metadata = chunk.metadata;

    // Completeness: Has examples, parameters, etc.
    const completeness = this.scoreCompleteness(content, metadata);

    // Specificity: How specific and actionable the content is
    const specificity = this.scoreSpecificity(content, metadata);

    // Usefulness: How useful for developers
    const usefulness = this.scoreUsefulness(content, metadata);

    // Clarity: How clear and well-structured
    const clarity = this.scoreClarity(content);

    const overall = (completeness + specificity + usefulness + clarity) / 4;

    return {
      overall,
      completeness,
      specificity,
      usefulness,
      clarity,
    };
  }

  /**
   * Score content completeness
   */
  private scoreCompleteness(content: string, metadata: ChunkMetadata): number {
    let score = 0.5; // Base score

    // Has code examples
    if (content.includes('```')) score += 0.2;

    // Has structured sections
    if (content.includes('##')) score += 0.1;

    // Has parameters or return values
    if (content.includes('Parameters') || content.includes('Returns'))
      score += 0.1;

    // Has troubleshooting
    if (
      content.includes('Common Issues') ||
      content.includes('Troubleshooting')
    )
      score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Score content specificity
   */
  private scoreSpecificity(content: string, metadata: ChunkMetadata): number {
    let score = 0.3; // Base score

    // Method-level chunks are more specific
    if (metadata.type === 'method') score += 0.3;

    // Has specific examples
    if (content.includes('example') || content.includes('Example'))
      score += 0.2;

    // Has detailed explanations
    const sentences = content.split('.').length;
    if (sentences > 5) score += 0.1;

    // Has specific use cases
    if (metadata.useCases && metadata.useCases.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Score content usefulness
   */
  private scoreUsefulness(content: string, metadata: ChunkMetadata): number {
    let score = 0.4; // Base score

    // Critical importance
    if (metadata.importance === 'critical') score += 0.3;
    else if (metadata.importance === 'high') score += 0.2;
    else if (metadata.importance === 'medium') score += 0.1;

    // Has practical examples
    if (content.includes('await') || content.includes('async')) score += 0.1;

    // Has error handling
    if (
      content.includes('try') ||
      content.includes('catch') ||
      content.includes('error')
    )
      score += 0.1;

    // Has common mistakes section
    if (metadata.commonMistakes && metadata.commonMistakes.length > 0)
      score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Score content clarity
   */
  private scoreClarity(content: string): number {
    let score = 0.5; // Base score

    // Well-structured with headers
    const headers = (content.match(/^#{1,6}\s+/gm) || []).length;
    if (headers > 0) score += Math.min(headers * 0.1, 0.3);

    // Good length (not too short, not too long)
    const length = content.length;
    if (length > 200 && length < 2000) score += 0.1;

    // Has clear explanations
    if (content.includes('This') || content.includes('Here')) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Sort chunks by priority (importance and quality)
   */
  private sortChunksByPriority(chunks: DocumentChunk[]): DocumentChunk[] {
    return chunks.sort((a, b) => {
      const aImportance = this.getImportanceScore(a.metadata.importance);
      const bImportance = this.getImportanceScore(b.metadata.importance);

      // First by importance
      if (aImportance !== bImportance) {
        return bImportance - aImportance;
      }

      // Then by quality (extract from tags)
      const aQuality = this.extractQualityFromTags(a.metadata.tags);
      const bQuality = this.extractQualityFromTags(b.metadata.tags);

      return bQuality - aQuality;
    });
  }

  /**
   * Get numeric score for importance level
   */
  private getImportanceScore(importance: ChunkMetadata['importance']): number {
    switch (importance) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Extract quality score from tags
   */
  private extractQualityFromTags(tags: string[]): number {
    const qualityTag = tags.find((tag) => tag.startsWith('quality:'));
    if (qualityTag) {
      const score = parseFloat(qualityTag.split(':')[1]);
      return isNaN(score) ? 0.5 : score;
    }
    return 0.5; // Default quality
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    // Simple hash function - normalize and hash content
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Calculate content similarity between two chunks
   */
  private calculateContentSimilarity(
    content1: string,
    content2: string
  ): number {
    // Simple Jaccard similarity using word sets
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = new Set(
      [...words1].filter((word) => words2.has(word))
    );
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Check if chunks are semantically similar
   */
  private areChunksSemanticallySimilar(
    chunk1: DocumentChunk,
    chunk2: DocumentChunk
  ): boolean {
    const metadata1 = chunk1.metadata;
    const metadata2 = chunk2.metadata;

    // Same class or related methods
    if (metadata1.className === metadata2.className) return true;

    // Share multiple tags
    const commonTags = metadata1.tags.filter((tag) =>
      metadata2.tags.includes(tag)
    );
    if (commonTags.length >= 3) return true;

    // Content similarity
    const contentSimilarity = this.calculateContentSimilarity(
      chunk1.content,
      chunk2.content
    );
    if (contentSimilarity > 0.3) return true;

    return false;
  }
}
