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
import crypto from 'crypto';

export interface VectorServiceConfig {
  openaiApiKey?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingModel?: string;
  collectionName?: string;
  forceReindex?: boolean; // Option to force full re-indexing
  indexCacheFile?: string; // File to persist document index
}

export interface DocumentIndex {
  [filePath: string]: {
    lastModified: number;
    contentHash: string;
    indexed: boolean;
  };
}

export class VectorService {
  private embeddings: OpenAIEmbeddings | null = null;
  private vectorStore: QdrantVectorStore | null = null;
  private isInitialized = false;
  private config: Required<VectorServiceConfig>;
  private documentIndex: DocumentIndex = {};

  constructor(config: VectorServiceConfig = {}) {
    this.config = {
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
      qdrantUrl:
        config.qdrantUrl || process.env.QDRANT_URL || 'http://localhost:6333',
      qdrantApiKey: config.qdrantApiKey || process.env.QDRANT_API_KEY || '',
      embeddingModel: config.embeddingModel || 'text-embedding-3-small',
      collectionName: config.collectionName || 'privmx-docs',
      forceReindex: config.forceReindex || process.env.FORCE_REINDEX === 'true',
      indexCacheFile:
        config.indexCacheFile ||
        process.env.VECTOR_INDEX_CACHE_FILE ||
        '.vector-index-cache.json',
    };

    // Load existing document index
    this.loadDocumentIndex();
  }

  /**
   * Load document index from persistent storage
   */
  private loadDocumentIndex(): void {
    try {
      if (fs.existsSync(this.config.indexCacheFile)) {
        const data = fs.readFileSync(this.config.indexCacheFile, 'utf-8');
        this.documentIndex = JSON.parse(data);
        console.log(
          `📋 Loaded document index with ${Object.keys(this.documentIndex).length} entries`
        );
      } else {
        console.log('📋 No existing document index found, starting fresh');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load document index, starting fresh:', error);
      this.documentIndex = {};
    }
  }

  /**
   * Save document index to persistent storage
   */
  private saveDocumentIndex(): void {
    try {
      fs.writeFileSync(
        this.config.indexCacheFile,
        JSON.stringify(this.documentIndex, null, 2)
      );
      console.log(
        `💾 Saved document index with ${Object.keys(this.documentIndex).length} entries`
      );
    } catch (error) {
      console.error('❌ Failed to save document index:', error);
    }
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Check if document needs reindexing
   */
  private needsReindexing(document: ParsedMDXDocument): boolean {
    const filePath = document.metadata.filePath || document.id;
    const existingEntry = this.documentIndex[filePath];

    if (!existingEntry || this.config.forceReindex) {
      return true;
    }

    // Check if file was modified
    try {
      const stats = fs.statSync(filePath);
      const currentModified = stats.mtimeMs;
      const contentStr =
        typeof document.content === 'string'
          ? document.content
          : document.content.markdown || '';
      const contentHash = this.generateContentHash(contentStr);

      return (
        currentModified > existingEntry.lastModified ||
        contentHash !== existingEntry.contentHash ||
        !existingEntry.indexed
      );
    } catch (error) {
      console.warn(
        `⚠️ Could not check file stats for ${filePath}, assuming needs reindexing`
      );
      return true;
    }
  }

  /**
   * Mark document as indexed
   */
  private markAsIndexed(document: ParsedMDXDocument): void {
    const filePath = document.metadata.filePath || document.id;
    try {
      const stats = fs.statSync(filePath);
      const contentStr =
        typeof document.content === 'string'
          ? document.content
          : document.content.markdown || '';
      this.documentIndex[filePath] = {
        lastModified: stats.mtimeMs,
        contentHash: this.generateContentHash(contentStr),
        indexed: true,
      };
    } catch (error) {
      console.warn(`⚠️ Could not update index for ${filePath}:`, error);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🧠 Initializing Vector Service with persistent caching...');

    if (!this.config.openaiApiKey) {
      console.warn(
        '⚠️ OpenAI API key not found. Vector search will be disabled.'
      );
      this.isInitialized = true;
      return;
    }

    try {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.config.openaiApiKey,
        modelName: this.config.embeddingModel,
        stripNewLines: true,
        batchSize: 512,
      });

      // Check if Qdrant collection exists
      const collectionExists = await this.checkQdrantCollection();
      if (collectionExists) {
        console.log(
          `✅ Qdrant collection '${this.config.collectionName}' exists`
        );
      } else {
        console.log(
          `📦 Qdrant collection '${this.config.collectionName}' will be created on first indexing`
        );
      }

      this.isInitialized = true;
      console.log('✅ Vector Service initialized successfully with caching');
    } catch (error) {
      console.error('❌ Failed to initialize Vector Service:', error);
      // Don't throw - allow fallback to text search
      this.isInitialized = true;
    }
  }

  /**
   * Check if Qdrant collection exists
   */
  private async checkQdrantCollection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.qdrantUrl}/collections/${this.config.collectionName}`,
        {
          method: 'GET',
          headers: this.config.qdrantApiKey
            ? { 'api-key': this.config.qdrantApiKey }
            : {},
        }
      );
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Could not check Qdrant collection:', error);
      return false;
    }
  }

  async indexDocuments(documents: ParsedMDXDocument[]): Promise<void> {
    if (!this.isInitialized || !this.embeddings) {
      console.warn('⚠️ Vector Service not initialized, skipping indexing');
      return;
    }

    console.log(`🔄 Checking ${documents.length} documents for indexing...`);

    // Filter documents that need reindexing
    const documentsToIndex = documents.filter((doc) =>
      this.needsReindexing(doc)
    );

    if (documentsToIndex.length === 0) {
      console.log('✅ All documents are up to date, no indexing needed');
      return;
    }

    console.log(
      `📊 Indexing ${documentsToIndex.length} documents (${documents.length - documentsToIndex.length} already cached)`
    );

    try {
      // Convert to Langchain documents
      const langchainDocs = documentsToIndex.map((doc) => {
        const contentStr =
          typeof doc.content === 'string'
            ? doc.content
            : doc.content.markdown || '';

        return new Document({
          pageContent: contentStr,
          metadata: {
            ...doc.metadata,
            title: doc.metadata.title || '',
            path: doc.metadata.filePath || doc.id,
          },
        });
      });

      // Create or connect to vector store
      this.vectorStore = await QdrantVectorStore.fromDocuments(
        langchainDocs,
        this.embeddings,
        {
          url: this.config.qdrantUrl,
          apiKey: this.config.qdrantApiKey || undefined,
          collectionName: this.config.collectionName,
        }
      );

      // Mark documents as indexed
      documentsToIndex.forEach((doc) => this.markAsIndexed(doc));

      // Save the updated index
      this.saveDocumentIndex();

      console.log(
        `✅ Successfully indexed ${documentsToIndex.length} documents`
      );
    } catch (error) {
      console.error('❌ Failed to index documents:', error);
      throw error;
    }
  }

  async search(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filters?: DocumentationSearchFilters;
    } = {}
  ): Promise<VectorSearchResult[]> {
    if (!this.isInitialized || !this.vectorStore) {
      console.warn('⚠️ Vector Service not available for search');
      return [];
    }

    const { limit = 10, threshold = 0.5 } = options;

    try {
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        limit
      );

      return results
        .filter(([_, score]) => score >= threshold)
        .map(([doc, score]) => ({
          documentId: doc.metadata.id || doc.metadata.documentId || '',
          title: doc.metadata.title || '',
          content: doc.pageContent,
          metadata: doc.metadata,
          score,
          path: doc.metadata.path || '',
          type: doc.metadata.type || 'document',
        }));
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      return [];
    }
  }

  isAvailable(): boolean {
    return (
      this.isInitialized && !!this.embeddings && !!this.config.openaiApiKey
    );
  }

  /**
   * Get indexing statistics
   */
  getIndexStats() {
    const totalDocs = Object.keys(this.documentIndex).length;
    const indexedDocs = Object.values(this.documentIndex).filter(
      (entry) => entry.indexed
    ).length;

    return {
      totalTracked: totalDocs,
      indexed: indexedDocs,
      pending: totalDocs - indexedDocs,
      cacheFile: this.config.indexCacheFile,
      lastCacheUpdate:
        totalDocs > 0
          ? Math.max(
              ...Object.values(this.documentIndex).map((e) => e.lastModified)
            )
          : 0,
    };
  }

  /**
   * Clear the document index (force full reindex)
   */
  clearIndex(): void {
    this.documentIndex = {};
    try {
      if (fs.existsSync(this.config.indexCacheFile)) {
        fs.unlinkSync(this.config.indexCacheFile);
        console.log('🗑️ Cleared document index cache');
      }
    } catch (error) {
      console.error('❌ Failed to clear index cache:', error);
    }
  }
}
