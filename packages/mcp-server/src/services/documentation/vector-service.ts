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
import path from 'path';
import {
  getVectorConfig,
  type VectorConfig,
} from '../../config/vector-config.js';
import { VectorStoreAdapter } from '../vector/vector-adapter.js';
import eventBus from '../../common/event-bus.js';
import { startSpan } from '../../common/otel.js';

export interface VectorServiceConfig {
  openaiApiKey?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingModel?: string;
  collectionName?: string;
  forceReindex?: boolean; // Option to force full re-indexing
  indexCacheFile?: string; // File to persist document index
}

export interface DocumentIndexStatus {
  documentId: string;
  lastModified: number;
  indexed: boolean;
  needsUpdate: boolean;
  contentHash?: string; // Add content hash for better change detection
}

export class VectorService implements VectorStoreAdapter {
  private embeddings: any = null;
  private vectorStore: any = null;
  private adapter?: VectorStoreAdapter;
  public config: VectorServiceConfig; // Made public for configuration access
  private initialized = false;
  private documentIndex: Map<string, DocumentIndexStatus> = new Map();
  private indexCacheFile: string;

  constructor(config: VectorServiceConfig = {}, adapter?: VectorStoreAdapter) {
    // Use the centralized configuration with fallback to passed config
    const defaultConfig = getVectorConfig();

    this.config = {
      openaiApiKey: config.openaiApiKey || defaultConfig.openai.apiKey,
      qdrantUrl: config.qdrantUrl || defaultConfig.qdrant.url,
      qdrantApiKey: config.qdrantApiKey || defaultConfig.qdrant.apiKey,
      embeddingModel: config.embeddingModel || defaultConfig.openai.model,
      collectionName:
        config.collectionName || defaultConfig.qdrant.collectionName,
      forceReindex: config.forceReindex || defaultConfig.caching.forceReindex,
      indexCacheFile:
        config.indexCacheFile || defaultConfig.caching.indexCacheFile,
    };

    // Set up cache file path relative to the project root
    this.indexCacheFile = path.resolve(
      process.cwd(),
      this.config.indexCacheFile!
    );

    // Save external adapter if provided (pluggable vector store)
    this.adapter = adapter;

    // Log configuration for debugging
    console.log(`🔧 Vector service configured:`);
    console.log(`   - Collection: ${this.config.collectionName}`);
    console.log(`   - Cache file: ${this.indexCacheFile}`);
    console.log(`   - Force reindex: ${this.config.forceReindex}`);
    console.log(`   - OpenAI enabled: ${!!this.config.openaiApiKey}`);
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
      eventBus.emit('vector.initialized');
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
    if (this.adapter) {
      return this.initialized; // trust adapter initialization status
    }
    return (
      this.initialized && this.embeddings !== null && this.vectorStore !== null
    );
  }

  /**
   * Index documents into Qdrant vector store with smart caching
   */
  async indexDocuments(documents: ParsedMDXDocument[]): Promise<void> {
    return startSpan('vector.indexDocuments', async () => {
      // Delegate to adapter if present
      if (this.adapter) {
        eventBus.emit('vector.index.start', documents.length);
        await this.adapter.indexDocuments(documents);
        eventBus.emit('vector.index.complete', documents.length);
        return;
      }

      if (!this.isAvailable()) {
        console.warn('Vector service not available, skipping vector indexing');
        return;
      }

      try {
        // First, check what's already indexed (load from persistent storage)
        await this.loadDocumentIndex();

        // Check if Qdrant collection exists and has documents
        const collectionExists = await this.checkCollectionExists();

        // Determine which documents need indexing
        const documentsToIndex = this.config.forceReindex
          ? documents
          : await this.filterDocumentsNeedingIndexing(
              documents,
              collectionExists
            );

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

        // Update our document index and persist it
        await this.updateDocumentIndex(documentsToIndex);
        await this.saveDocumentIndex();

        eventBus.emit('vector.index.complete', documentsToIndex.length);

        console.log(
          `✅ Successfully indexed ${langchainDocs.length} document chunks in Qdrant`
        );
      } catch (error) {
        console.error('Failed to index documents in vector store:', error);
        throw error;
      }
    });
  }

  /**
   * Perform semantic search using vector embeddings
   */
  async semanticSearch(
    query: string,
    filters?: DocumentationSearchFilters,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    return startSpan('vector.semanticSearch', async () => {
      // Delegate to adapter if present
      if (this.adapter) {
        return this.adapter.semanticSearch(query, filters, limit);
      }

      if (!this.isAvailable()) {
        console.warn(
          'Vector service not available, falling back to text search'
        );
        return [];
      }

      try {
        eventBus.emit('vector.search.started', { query });

        // Build optional filters for Qdrant
        const qdrantFilter = this.buildQdrantFilter(filters);

        const results = await (
          this.vectorStore as QdrantVectorStore
        ).similaritySearchWithScore(query, limit, qdrantFilter);

        const mapped: VectorSearchResult[] = results.map(([doc, score]) => ({
          documentId: doc.metadata.id as string,
          title: doc.metadata.title as string,
          content: doc.pageContent,
          metadata: doc.metadata,
          score,
          type: doc.metadata.type as 'document' | 'code',
        }));

        eventBus.emit('vector.search.completed', {
          query,
          results: mapped.length,
        });
        return mapped;
      } catch (error) {
        console.error('Vector search failed:', error);
        return [];
      }
    });
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string,
    limit: number = 5
  ): Promise<VectorSearchResult[]> {
    return startSpan('vector.findSimilar', async () => {
      if (this.adapter) {
        return this.adapter.findSimilarDocuments(documentId, limit);
      }

      // Fallback to semantic search by using documentId as query text
      return this.semanticSearch(documentId, undefined, limit);
    });
  }

  /**
   * Get vector store statistics
   */
  async getStats(): Promise<{ totalVectors: number; isAvailable: boolean }> {
    return startSpan('vector.stats', async () => {
      if (this.adapter) {
        return this.adapter.getStats();
      }

      if (!this.isAvailable()) {
        return { totalVectors: 0, isAvailable: false };
      }

      try {
        const info = await (this.vectorStore as any).client.getCollection(
          this.config.collectionName
        );

        return {
          totalVectors: info?.vectors_count || 0,
          isAvailable: true,
        };
      } catch (error) {
        console.warn('Failed to fetch vector stats:', error);
        return { totalVectors: 0, isAvailable: false };
      }
    });
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
    if (this.adapter && (this.adapter as any).clearCollection) {
      await (this.adapter as any).clearCollection();
      return;
    }

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
      await this.saveDocumentIndex();
    } catch (error) {
      console.error('Failed to clear vector collection:', error);
    }
  }

  /**
   * Load document index from persistent storage
   */
  private async loadDocumentIndex(): Promise<void> {
    try {
      if (fs.existsSync(this.indexCacheFile)) {
        const indexData = await fs.promises.readFile(
          this.indexCacheFile,
          'utf-8'
        );
        const indexObject = JSON.parse(indexData);

        // Convert object back to Map
        this.documentIndex = new Map(Object.entries(indexObject));

        console.log(
          `📋 Loaded persistent document index with ${this.documentIndex.size} entries from ${this.indexCacheFile}`
        );
      } else {
        console.log('📋 No existing document index found, starting fresh');
      }
    } catch (error) {
      console.warn('Failed to load document index from file:', error);
      console.log('📋 Starting with fresh document index');
      this.documentIndex.clear();
    }
  }

  /**
   * Save document index to persistent storage
   */
  private async saveDocumentIndex(): Promise<void> {
    try {
      // Convert Map to plain object for JSON serialization
      const indexObject = Object.fromEntries(this.documentIndex);

      await fs.promises.writeFile(
        this.indexCacheFile,
        JSON.stringify(indexObject, null, 2),
        'utf-8'
      );

      console.log(
        `💾 Saved document index with ${this.documentIndex.size} entries to ${this.indexCacheFile}`
      );
    } catch (error) {
      console.warn('Failed to save document index to file:', error);
    }
  }

  /**
   * Check if Qdrant collection exists and has documents
   */
  private async checkCollectionExists(): Promise<boolean> {
    try {
      if (!this.vectorStore) return false;

      // Try to perform a simple search to check if collection has data
      const testResults = await this.vectorStore.similaritySearchWithScore(
        'test',
        1
      );

      return testResults.length > 0;
    } catch (error) {
      // Collection might not exist or be empty
      console.log("📊 Qdrant collection appears to be empty or doesn't exist");
      return false;
    }
  }

  /**
   * Filter documents that need indexing based on modification times and content hashes
   */
  private async filterDocumentsNeedingIndexing(
    documents: ParsedMDXDocument[],
    collectionExists: boolean
  ): Promise<ParsedMDXDocument[]> {
    const needsIndexing: ParsedMDXDocument[] = [];

    for (const doc of documents) {
      const existingIndex = this.documentIndex.get(doc.id);
      const fileModTime = this.getFileModificationTime(doc.metadata.filePath);
      const currentContentHash = doc.contentHash; // Use the hash from parsed document

      if (!existingIndex) {
        // New document, needs indexing
        needsIndexing.push(doc);
        continue;
      }

      // Check if file has been modified since last indexing
      if (fileModTime > existingIndex.lastModified) {
        needsIndexing.push(doc);
        continue;
      }

      // Check if content hash has changed (more reliable than file modification time)
      if (currentContentHash !== existingIndex.contentHash) {
        needsIndexing.push(doc);
        continue;
      }

      // If collection doesn't exist in Qdrant, we need to reindex everything
      if (!collectionExists && existingIndex.indexed) {
        needsIndexing.push(doc);
        continue;
      }
    }

    // If we have no documents that need indexing but the collection doesn't exist,
    // and we have indexed documents in our cache, we might have lost the Qdrant data
    if (
      needsIndexing.length === 0 &&
      !collectionExists &&
      this.documentIndex.size > 0
    ) {
      console.log(
        '⚠️ Document index exists but Qdrant collection is empty. Re-indexing all documents.'
      );
      return documents;
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
        contentHash: doc.contentHash, // Store content hash for better change detection
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
