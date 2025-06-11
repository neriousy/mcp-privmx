/**
 * Vector Service for Documentation
 *
 * Handles vector embeddings and semantic search using OpenAI embeddings
 * and Qdrant vector database for MDX documentation.
 * Uses dynamic imports to handle optional dependencies gracefully.
 */

import type {
  ParsedMDXDocument,
  DocumentationSearchFilters,
  VectorSearchResult,
} from '../../types/documentation-types.js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import fs from 'fs';

export interface VectorServiceConfig {
  openaiApiKey?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingModel?: string;
  collectionName?: string;
  forceReindex?: boolean; // Option to force full re-indexing
}

export interface DocumentIndexStatus {
  documentId: string;
  lastModified: number;
  indexed: boolean;
  needsUpdate: boolean;
}

export class VectorService {
  private embeddings: any = null;
  private vectorStore: any = null;
  public config: VectorServiceConfig; // Made public for configuration access
  private initialized = false;
  private documentIndex: Map<string, DocumentIndexStatus> = new Map();

  constructor(config: VectorServiceConfig = {}) {
    this.config = {
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      qdrantUrl:
        config.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: config.qdrantApiKey || process.env.QDRANT_API_KEY,
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      collectionName: config.collectionName || 'privmx-docs',
      forceReindex: false,
      ...config,
    };
  }

  /**
   * Initialize the vector service with OpenAI embeddings and Qdrant
   */
  async initialize(): Promise<void> {
    try {
      if (!this.config.openaiApiKey) {
        console.warn(
          'OpenAI API key not provided. Vector search will be disabled.'
        );
        return;
      }

      // Initialize OpenAI embeddings
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.config.openaiApiKey,
        modelName: this.config.embeddingModel,
        batchSize: 512, // Optimize for performance
        stripNewLines: true,
      });

      // Initialize Qdrant vector store
      this.vectorStore = new QdrantVectorStore(this.embeddings, {
        url: this.config.qdrantUrl,
        apiKey: this.config.qdrantApiKey,
        collectionName: this.config.collectionName,
      });

      this.initialized = true;
      console.log(
        `✅ Vector service initialized with ${this.config.embeddingModel} embeddings and Qdrant`
      );
    } catch (error) {
      console.warn('Failed to initialize vector service:', error);
      console.warn('Falling back to text-based search only');
      this.embeddings = null;
      this.vectorStore = null;
    }
  }

  /**
   * Check if vector service is available
   */
  isAvailable(): boolean {
    return (
      this.initialized && this.embeddings !== null && this.vectorStore !== null
    );
  }

  /**
   * Index documents into Qdrant vector store with smart caching
   */
  async indexDocuments(documents: ParsedMDXDocument[]): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('Vector service not available, skipping vector indexing');
      return;
    }

    try {
      // First, check what's already indexed
      await this.loadDocumentIndex();

      // Determine which documents need indexing
      const documentsToIndex = this.config.forceReindex
        ? documents
        : this.filterDocumentsNeedingIndexing(documents);

      if (documentsToIndex.length === 0) {
        console.log('✅ All documents are up to date, no re-indexing needed');
        return;
      }

      console.log(
        `📊 Creating vector embeddings for ${documentsToIndex.length}/${documents.length} documents...`
      );

      // Convert documents to LangChain Document format
      const langchainDocs: any[] = [];

      for (const doc of documentsToIndex) {
        // Create main document chunk
        const mainDoc = new Document({
          pageContent: this.prepareContentForEmbedding(doc),
          metadata: {
            id: doc.id,
            title: doc.metadata.title,
            language: doc.metadata.language,
            namespace: doc.metadata.namespace,
            category: doc.metadata.category,
            skillLevel: doc.metadata.skillLevel,
            filePath: doc.metadata.filePath,
            type: 'document',
            hasCodeExamples: doc.content.codeBlocks.length > 0,
            concepts: doc.content.concepts.join(','),
            apiReferences: doc.content.apiReferences.join(','),
          },
        });
        langchainDocs.push(mainDoc);

        // Create separate embeddings for each code block
        for (let i = 0; i < doc.content.codeBlocks.length; i++) {
          const codeBlock = doc.content.codeBlocks[i];
          const codeDoc = new Document({
            pageContent: `${codeBlock.title || 'Code Example'}\n\n${codeBlock.code}`,
            metadata: {
              id: `${doc.id}_code_${i}`,
              parentId: doc.id,
              title: `${doc.metadata.title} - Code Example`,
              language: codeBlock.language,
              namespace: doc.metadata.namespace,
              category: doc.metadata.category,
              type: 'code',
              codeLanguage: codeBlock.language,
              complexity: this.determineComplexity(codeBlock.code),
              isComplete: codeBlock.isComplete,
            },
          });
          langchainDocs.push(codeDoc);
        }
      }

      // Remove old versions of updated documents
      for (const doc of documentsToIndex) {
        await this.removeDocumentFromIndex(doc.id);
      }

      // Index all documents in Qdrant
      await this.vectorStore.addDocuments(langchainDocs);

      // Update our document index
      await this.updateDocumentIndex(documentsToIndex);

      console.log(
        `✅ Successfully indexed ${langchainDocs.length} document chunks in Qdrant`
      );
    } catch (error) {
      console.error('Failed to index documents in vector store:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search using vector embeddings
   */
  async semanticSearch(
    query: string,
    filters?: DocumentationSearchFilters,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error('Vector service not available');
    }

    try {
      // Build Qdrant filter based on documentation filters
      const qdrantFilter = this.buildQdrantFilter(filters);

      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        limit * 2, // Get more results to filter and rank
        qdrantFilter
      );

      // Convert results to our format
      const vectorResults: VectorSearchResult[] = results.map(
        ([doc, score]: [any, number]) => ({
          documentId: doc.metadata.parentId || doc.metadata.id,
          title: doc.metadata.title,
          content: doc.pageContent,
          metadata: doc.metadata,
          score: 1 - score, // Convert distance to similarity score
          type: doc.metadata.type || 'document',
        })
      );

      // Group by document ID and take the best score for each document
      const grouped = new Map<string, VectorSearchResult>();
      for (const result of vectorResults) {
        const existing = grouped.get(result.documentId);
        if (!existing || result.score > existing.score) {
          grouped.set(result.documentId, result);
        }
      }

      // Return top results sorted by score
      return Array.from(grouped.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    if (!this.isAvailable()) {
      throw new Error('Vector service not available');
    }

    try {
      // First, get the document content to use as query
      const results = await this.vectorStore.similaritySearchWithScore(
        '', // Empty query, we'll filter by document ID
        1,
        { must: [{ key: 'id', match: { value: documentId } }] }
      );

      if (results.length === 0) {
        return [];
      }

      const [sourceDoc] = results[0];

      // Now find similar documents
      return this.semanticSearch(
        sourceDoc.pageContent,
        undefined,
        limit + 1
      ).then((results) => results.filter((r) => r.documentId !== documentId));
    } catch (error) {
      console.error('Failed to find similar documents:', error);
      return [];
    }
  }

  /**
   * Get vector store statistics
   */
  async getStats(): Promise<{ totalVectors: number; isAvailable: boolean }> {
    if (!this.isAvailable()) {
      return { totalVectors: 0, isAvailable: false };
    }

    try {
      // Note: This is a simplified stat - Qdrant has more detailed collection info available
      return {
        totalVectors: 0, // Would need Qdrant client to get actual count
        isAvailable: true,
      };
    } catch (error) {
      return { totalVectors: 0, isAvailable: false };
    }
  }

  /**
   * Prepare document content for embedding
   */
  private prepareContentForEmbedding(doc: ParsedMDXDocument): string {
    const parts = [
      doc.metadata.title,
      doc.metadata.description || '',
      doc.content.markdown,
    ];

    // Add key concepts and API references
    if (doc.content.concepts.length > 0) {
      parts.push(`Concepts: ${doc.content.concepts.join(', ')}`);
    }

    if (doc.content.apiReferences.length > 0) {
      parts.push(`APIs: ${doc.content.apiReferences.join(', ')}`);
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Build Qdrant filter from documentation filters
   */
  private buildQdrantFilter(filters?: DocumentationSearchFilters): any {
    if (!filters) return undefined;

    const conditions: any[] = [];

    if (filters.language) {
      conditions.push({
        key: 'language',
        match: { value: filters.language },
      });
    }

    if (filters.namespace) {
      conditions.push({
        key: 'namespace',
        match: { value: filters.namespace },
      });
    }

    if (filters.category) {
      conditions.push({
        key: 'category',
        match: { value: filters.category },
      });
    }

    if (filters.skillLevel) {
      conditions.push({
        key: 'skillLevel',
        match: { value: filters.skillLevel },
      });
    }

    if (filters.hasCodeExamples) {
      conditions.push({
        key: 'hasCodeExamples',
        match: { value: filters.hasCodeExamples },
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Determine code complexity level
   */
  private determineComplexity(
    code: string
  ): 'simple' | 'intermediate' | 'advanced' {
    const lines = code.split('\n').length;
    const complexityIndicators = [
      'class',
      'interface',
      'async',
      'await',
      'promise',
      'error',
      'try',
      'catch',
    ];

    let complexityScore = 0;
    for (const indicator of complexityIndicators) {
      if (code.toLowerCase().includes(indicator)) complexityScore++;
    }

    if (lines > 20 || complexityScore > 3) return 'advanced';
    if (lines > 10 || complexityScore > 1) return 'intermediate';
    return 'simple';
  }

  /**
   * Clear all documents from the vector store
   */
  async clearCollection(): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('Vector service not available, nothing to clear');
      return;
    }

    try {
      // Note: QdrantVectorStore doesn't have a built-in clear method
      // You might need to use the Qdrant client directly for this
      console.log(
        '⚠️ Clear collection not implemented - would need direct Qdrant client'
      );
      this.documentIndex.clear();
    } catch (error) {
      console.error('Failed to clear vector collection:', error);
    }
  }

  /**
   * Load document index from storage or memory
   */
  private async loadDocumentIndex(): Promise<void> {
    try {
      // For now, we use an in-memory index that tracks what's been indexed
      // In production, this could be persisted to a file or database
      if (this.documentIndex.size === 0) {
        console.log('📋 Initializing fresh document index...');
      } else {
        console.log(
          `📋 Loaded document index with ${this.documentIndex.size} entries`
        );
      }
    } catch (error) {
      console.warn('Failed to load document index:', error);
    }
  }

  /**
   * Filter documents that need indexing based on modification times
   */
  private filterDocumentsNeedingIndexing(
    documents: ParsedMDXDocument[]
  ): ParsedMDXDocument[] {
    const needsIndexing: ParsedMDXDocument[] = [];

    for (const doc of documents) {
      const existingIndex = this.documentIndex.get(doc.id);

      if (!existingIndex) {
        // New document, needs indexing
        needsIndexing.push(doc);
        continue;
      }

      // Check if file has been modified since last indexing
      const fileModTime = this.getFileModificationTime(doc.metadata.filePath);
      if (fileModTime > existingIndex.lastModified) {
        needsIndexing.push(doc);
      }
    }

    return needsIndexing;
  }

  /**
   * Remove a document from the vector index
   */
  private async removeDocumentFromIndex(documentId: string): Promise<void> {
    try {
      // Remove from our tracking index
      this.documentIndex.delete(documentId);

      // Note: Removing from Qdrant would require direct client access
      // For now, we rely on unique IDs to overwrite old versions
    } catch (error) {
      console.warn(
        `Failed to remove document ${documentId} from index:`,
        error
      );
    }
  }

  /**
   * Update document index with newly indexed documents
   */
  private async updateDocumentIndex(
    documents: ParsedMDXDocument[]
  ): Promise<void> {
    for (const doc of documents) {
      const fileModTime = this.getFileModificationTime(doc.metadata.filePath);

      this.documentIndex.set(doc.id, {
        documentId: doc.id,
        lastModified: fileModTime,
        indexed: true,
        needsUpdate: false,
      });
    }
  }

  /**
   * Get file modification time safely
   */
  private getFileModificationTime(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime.getTime();
    } catch (_error) {
      // If we can't get modification time, assume it needs updating
      return Date.now();
    }
  }
}
