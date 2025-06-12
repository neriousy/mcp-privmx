/**
 * Documentation Index Service
 *
 * Manages the indexing and searching of MDX documentation files.
 * Provides both vector-based semantic search and text-based search capabilities.
 */

import {
  ParsedMDXDocument,
  DocumentationSearchFilters,
  DocumentationResult,
} from '../../types/documentation-types.js';
import { VectorService } from './vector-service.js';
import { MDXProcessorService } from './mdx-processor.js';
import path from 'path';
import fs from 'fs';

export class DocumentationIndex {
  private documents: Map<string, ParsedMDXDocument> = new Map();
  private vectorService: VectorService;
  private mdxProcessor: MDXProcessorService;
  private initialized = false;

  constructor() {
    this.vectorService = new VectorService();
    this.mdxProcessor = new MDXProcessorService();
  }

  async initialize(documentsPath: string, forceReindex = false): Promise<void> {
    if (this.initialized && !forceReindex) {
      return;
    }

    console.log('📚 Initializing Documentation Index...');

    try {
      // Initialize the vector service first
      await this.vectorService.initialize();

      console.log(`📖 Loading documentation from: ${documentsPath}`);

      // Load and process all MDX files
      await this.loadDocuments(documentsPath);

      // Index documents for vector search if available
      if (this.vectorService.isAvailable()) {
        console.log('🧠 Creating vector embeddings...');
        await this.vectorService.indexDocuments(
          Array.from(this.documents.values())
        );

        // Get indexing stats
        const stats = this.vectorService.getIndexStats();
        console.log(
          `📊 Vector indexing complete: ${stats.indexed}/${stats.totalTracked} documents indexed`
        );
      } else {
        console.log('📝 Vector search disabled, using text-based search only');
      }

      this.initialized = true;
      console.log(
        `✅ Documentation index ready with ${this.documents.size} documents`
      );
    } catch (error) {
      console.error('❌ Failed to initialize documentation index:', error);
      throw error;
    }
  }

  /**
   * Force reindexing of all documents
   */
  async reindex(): Promise<void> {
    console.log('🔄 Force reindexing documentation...');

    if (this.vectorService.isAvailable()) {
      // Clear the vector index cache
      this.vectorService.clearIndex();
    }

    // Re-initialize with force flag
    await this.initialize('', true);
  }

  private async loadDocuments(documentsPath: string): Promise<void> {
    const startTime = Date.now();
    this.documents.clear();

    // Find all MDX files recursively
    const mdxFiles = await this.findMDXFiles(documentsPath);
    console.log(`📄 Found ${mdxFiles.length} MDX files`);

    // Process each file
    let processedCount = 0;
    for (const filePath of mdxFiles) {
      try {
        const document = await this.mdxProcessor.parseMDXFile(filePath);
        this.documents.set(document.id, document);
        processedCount++;

        // Log progress for large document sets
        if (processedCount % 10 === 0) {
          console.log(
            `📄 Processed ${processedCount}/${mdxFiles.length} documents...`
          );
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process ${filePath}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`📄 Processed ${processedCount} documents in ${duration}ms`);
  }

  private async findMDXFiles(dirPath: string): Promise<string[]> {
    const mdxFiles: string[] = [];

    const processDirectory = async (currentPath: string): Promise<void> => {
      if (!fs.existsSync(currentPath)) {
        console.warn(`⚠️ Path does not exist: ${currentPath}`);
        return;
      }

      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await processDirectory(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
          mdxFiles.push(fullPath);
        }
      }
    };

    await processDirectory(dirPath);
    return mdxFiles;
  }

  /**
   * Search documentation using semantic similarity (vector search) if available,
   * otherwise fall back to text-based search
   */
  async search(
    query: string,
    filters?: DocumentationSearchFilters,
    limit: number = 10
  ): Promise<DocumentationResult[]> {
    if (!this.initialized) {
      throw new Error('Documentation index not initialized');
    }

    // Try vector search first if available
    if (this.vectorService.isAvailable()) {
      try {
        const vectorResults = await this.vectorService.search(query, {
          limit,
          filters,
          threshold: 0.5,
        });

        // Convert vector results to documentation results
        const resultDocuments = vectorResults
          .map((result) => {
            // Find document by ID from vector metadata
            const docId = result.metadata.id || result.documentId;
            return this.documents.get(docId);
          })
          .filter(
            (doc): doc is ParsedMDXDocument => doc !== undefined && doc !== null
          );

        return resultDocuments.map((doc) =>
          this.convertToSearchResult(doc, 'vector', query)
        );
      } catch (error) {
        console.warn(
          'Vector search failed, falling back to text search:',
          error
        );
      }
    }

    // Fallback to text-based search
    return this.textSearch(query, filters, limit);
  }

  /**
   * Text-based search implementation
   */
  private textSearch(
    query: string,
    filters?: DocumentationSearchFilters,
    limit: number = 10
  ): DocumentationResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ document: ParsedMDXDocument; score: number }> = [];

    for (const document of this.documents.values()) {
      // Apply filters if specified
      if (filters && !this.documentMatchesFilters(document, filters)) {
        continue;
      }

      const score = this.calculateTextScore(document, queryTerms);
      if (score > 0) {
        results.push({ document, score });
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);

    return results
      .slice(0, limit)
      .map(({ document }) =>
        this.convertToSearchResult(document, 'text', query)
      );
  }

  private calculateTextScore(
    document: ParsedMDXDocument,
    queryTerms: string[]
  ): number {
    let score = 0;
    const title = document.metadata.title?.toLowerCase() || '';
    const content = document.content.markdown?.toLowerCase() || '';

    for (const term of queryTerms) {
      // Title matches are weighted higher
      const titleMatches = (title.match(new RegExp(term, 'g')) || []).length;
      score += titleMatches * 3;

      // Content matches
      const contentMatches = (content.match(new RegExp(term, 'g')) || [])
        .length;
      score += contentMatches;
    }

    return score;
  }

  private documentMatchesFilters(
    document: ParsedMDXDocument,
    filters: DocumentationSearchFilters
  ): boolean {
    if (filters.language && document.metadata.language !== filters.language) {
      return false;
    }

    if (
      filters.namespace &&
      document.metadata.namespace !== filters.namespace
    ) {
      return false;
    }

    if (filters.category && document.metadata.category !== filters.category) {
      return false;
    }

    if (
      filters.skillLevel &&
      document.metadata.skillLevel !== filters.skillLevel
    ) {
      return false;
    }

    return true;
  }

  private convertToSearchResult(
    document: ParsedMDXDocument,
    searchType: 'vector' | 'text',
    query: string
  ): DocumentationResult {
    // Extract a relevant snippet from the content
    const content = document.content.markdown || '';
    const snippet = this.extractSnippet(content, query);

    return {
      id: document.id,
      title: document.metadata.title || 'Untitled',
      summary: snippet,
      content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      metadata: document.metadata,
      codeExamples: document.content.codeBlocks.map((block) => ({
        language: block.language,
        code: block.code,
        title: block.title,
        complexity: 'simple' as const,
        isRunnable: block.isComplete || false,
        sourceDocument: document.id,
      })),
      relatedAPIs: document.content.apiReferences,
      relatedDocs: [],
      score: 1.0,
      aiInsights: {
        keyTakeaways: [],
        commonPitfalls: [],
        bestPractices: [],
        prerequisites: [],
        nextSteps: [],
      },
    };
  }

  private extractSnippet(
    content: string,
    query: string,
    maxLength: number = 200
  ): string {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    // Find the first occurrence of any query term
    let bestIndex = -1;
    for (const term of queryTerms) {
      const index = contentLower.indexOf(term);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      // No terms found, return beginning of content
      return (
        content.substring(0, maxLength) +
        (content.length > maxLength ? '...' : '')
      );
    }

    // Extract snippet around the found term
    const start = Math.max(0, bestIndex - 50);
    const end = Math.min(content.length, start + maxLength);
    let snippet = content.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get all available documents
   */
  getAllDocuments(): ParsedMDXDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): ParsedMDXDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get search statistics
   */
  async getStats() {
    const stats = {
      totalDocuments: this.documents.size,
      vectorSearchAvailable: this.vectorService.isAvailable(),
      initialized: this.initialized,
    };

    // Add vector service stats if available
    if (this.vectorService.isAvailable()) {
      const vectorStats = this.vectorService.getIndexStats();
      return {
        ...stats,
        vectorStats,
      };
    }

    return stats;
  }
}
