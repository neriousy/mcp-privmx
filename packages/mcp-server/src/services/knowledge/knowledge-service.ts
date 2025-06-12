/**
 * Knowledge Service
 *
 * High-level service that orchestrates API, documentation, and code generation
 * services to provide comprehensive knowledge management capabilities.
 */

import { APISearchService } from '../api/api-search-service.js';
import { CodeGenerationService } from '../generation/code-generation-service.js';
import { DocumentationIndex } from '../documentation/documentation-index.js';
import { VectorService } from '../documentation/vector-service.js';
import {
  DocumentationResult,
  ParsedMDXDocument,
  DocumentationSearchFilters,
} from '../../types/documentation-types.js';
import { SearchResult } from '../../types/index.js';
import path from 'path';

// Simple interfaces for this service
interface KnowledgeSearchRequest {
  query: string;
  limit?: number;
  includeDocumentation?: boolean;
  includeAPI?: boolean;
  includeCode?: boolean;
  filters?: DocumentationSearchFilters;
}

interface KnowledgeSearchResult {
  type: 'documentation' | 'api' | 'code';
  source: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  url: string;
  data: any;
}

interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeSearchResult[];
  totalResults: number;
  searchTime: number;
  sources: {
    documentation: number;
    api: number;
    code: number;
  };
}

export class KnowledgeService {
  private apiSearchService: APISearchService;
  private codeGenerationService: CodeGenerationService;
  private documentationIndex: DocumentationIndex;
  private vectorService: VectorService;
  private initialized = false;
  private apiData: Map<string, unknown> = new Map();

  constructor() {
    this.apiSearchService = new APISearchService();
    this.codeGenerationService = new CodeGenerationService();
    this.documentationIndex = new DocumentationIndex();
    this.vectorService = new VectorService();
  }

  async initialize(specPath?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🧠 Initializing Knowledge Service...');

    try {
      // Initialize API search service
      if (specPath) {
        console.log('🔍 Initializing API search service...');
        // Create a simple API data map for initialization
        this.apiData.set('specPath', specPath);
        await this.apiSearchService.initialize(this.apiData);
      }

      // Initialize code generation service
      console.log('🛠️ Initializing code generation service...');
      await this.codeGenerationService.initialize();

      // Initialize documentation index
      if (specPath) {
        console.log('📚 Initializing documentation index...');
        await this.documentationIndex.initialize(specPath);
      }

      this.initialized = true;
      console.log('✅ Knowledge Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Knowledge Service:', error);
      throw error;
    }
  }

  /**
   * Unified search across all knowledge sources
   */
  async search(
    request: KnowledgeSearchRequest
  ): Promise<KnowledgeSearchResponse> {
    if (!this.initialized) {
      throw new Error('Knowledge service not initialized');
    }

    console.log(`🔍 Knowledge search: "${request.query}"`);

    const results: KnowledgeSearchResult[] = [];
    const searchPromises: Promise<void>[] = [];

    // Search documentation
    if (request.includeDocumentation !== false) {
      searchPromises.push(
        this.searchDocumentation(request.query, request.filters, request.limit)
          .then((docs) => {
            results.push(
              ...docs.map((doc) => ({
                type: 'documentation' as const,
                source: 'documentation',
                title: doc.title,
                content: doc.content,
                metadata: doc.metadata,
                score: doc.score,
                url: doc.metadata.filePath || '',
                data: doc,
              }))
            );
          })
          .catch((error) => {
            console.warn('Documentation search failed:', error);
          })
      );
    }

    // Search API endpoints
    if (request.includeAPI !== false) {
      searchPromises.push(
        this.searchAPI(request.query, request.limit)
          .then((apis) => {
            results.push(
              ...apis.map((api) => ({
                type: 'api' as const,
                source: 'api',
                title:
                  typeof api.title === 'string'
                    ? api.title
                    : typeof api.metadata?.name === 'string'
                      ? api.metadata.name
                      : 'API Result',
                content:
                  typeof api.content === 'string'
                    ? api.content
                    : typeof api.metadata?.description === 'string'
                      ? api.metadata.description
                      : '',
                metadata: api.metadata || {},
                score: typeof api.score === 'number' ? api.score : 1.0,
                url:
                  typeof api.metadata?.endpoint === 'string'
                    ? api.metadata.endpoint
                    : '',
                data: api,
              }))
            );
          })
          .catch((error) => {
            console.warn('API search failed:', error);
          })
      );
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    // Sort results by score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Apply final limit
    const finalLimit = request.limit || 20;
    const limitedResults = results.slice(0, finalLimit);

    return {
      query: request.query,
      results: limitedResults,
      totalResults: results.length,
      searchTime: Date.now(),
      sources: {
        documentation: limitedResults.filter((r) => r.type === 'documentation')
          .length,
        api: limitedResults.filter((r) => r.type === 'api').length,
        code: limitedResults.filter((r) => r.type === 'code').length,
      },
    };
  }

  /**
   * Search documentation
   */
  async searchDocumentation(
    query: string,
    filters?: DocumentationSearchFilters,
    limit?: number
  ): Promise<DocumentationResult[]> {
    try {
      return await this.documentationIndex.search(query, filters, limit);
    } catch (error) {
      console.error('Documentation search failed:', error);
      return [];
    }
  }

  /**
   * Search API endpoints
   */
  async searchAPI(query: string, limit?: number): Promise<SearchResult[]> {
    try {
      // Use the API search service's basic search method
      return await this.apiSearchService.search(query, { limit });
    } catch (error) {
      console.error('API search failed:', error);
      return [];
    }
  }

  /**
   * Get comprehensive information about a specific topic
   */
  async getTopicInfo(topic: string): Promise<{
    documentation: DocumentationResult[];
    apis: SearchResult[];
  }> {
    const [documentation, apis] = await Promise.all([
      this.searchDocumentation(topic, undefined, 5),
      this.searchAPI(topic, 5),
    ]);

    return {
      documentation,
      apis,
    };
  }

  /**
   * Get service statistics
   */
  async getStats() {
    const stats = {
      initialized: this.initialized,
      documentation: await this.documentationIndex.getStats(),
      api: this.apiSearchService.getStats(),
    };

    return stats;
  }

  /**
   * Force reindexing of all knowledge sources
   */
  async reindex(): Promise<void> {
    console.log('🔄 Reindexing all knowledge sources...');

    const promises: Promise<void>[] = [];

    // Reindex documentation
    promises.push(
      this.documentationIndex.reindex().catch((error) => {
        console.error('Failed to reindex documentation:', error);
      })
    );

    await Promise.all(promises);
    console.log('✅ Knowledge reindexing complete');
  }

  /**
   * Check if the service is ready to handle requests
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get all available documents
   */
  getAllDocuments(): ParsedMDXDocument[] {
    return this.documentationIndex.getAllDocuments();
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): ParsedMDXDocument | undefined {
    return this.documentationIndex.getDocument(id);
  }

  /**
   * Generate setup code for a specific language
   */
  generateSetupCode(language: string, features: string[]): string {
    return this.codeGenerationService.generateSetupCode(language, features);
  }

  /**
   * Get AI-powered insights for a query
   */
  async getAIInsights(query: string): Promise<{
    summary: string;
    keyPoints: string[];
    recommendations: string[];
    relatedTopics: string[];
  }> {
    // This would integrate with AI service for insights
    // For now, return basic analysis
    const searchResults = await this.search({
      query,
      limit: 10,
      includeDocumentation: true,
      includeAPI: true,
      includeCode: false,
    });

    const summary = `Found ${searchResults.totalResults} results related to "${query}"`;
    const keyPoints = searchResults.results
      .slice(0, 3)
      .map((result) => result.title);
    const recommendations = [
      'Review the documentation for comprehensive understanding',
      'Check API endpoints for implementation details',
    ];
    const relatedTopics = Array.from(
      new Set(
        searchResults.results
          .map((result) => Object.keys(result.metadata || {}))
          .flat()
          .filter((key) => key !== 'filePath' && key !== 'title')
      )
    ).slice(0, 5);

    return {
      summary,
      keyPoints,
      recommendations,
      relatedTopics,
    };
  }
}
