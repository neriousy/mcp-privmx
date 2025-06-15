/**
 * KnowledgeService - Main orchestrator for knowledge operations
 *
 * This service acts as a thin facade that coordinates between:
 * - Knowledge building and graph construction
 * - Knowledge repository for data access
 * - API discovery and analysis
 * - Documentation search and indexing
 */

import { APISearchService } from '../api/api-search-service.js';
import { CodeGenerationService } from '../generation/code-generation-service.js';
import { KnowledgeBuilder } from './knowledge-builder.js';
import { KnowledgeRepository } from './knowledge-repository.js';
import { DocumentationIndexService } from '../documentation/documentation-index.js';
import type {
  SearchResult,
  CodeContext,
  GeneratedCode,
} from '../../types/index.js';
import type {
  DocumentationResult,
  DocumentationSearchFilters,
  SearchContext,
  CodeExample,
} from '../../types/documentation-types.js';
import { startSpan } from '../../common/otel.js';

export class KnowledgeService {
  private knowledgeBuilder: KnowledgeBuilder;
  private knowledgeRepository: KnowledgeRepository;
  private apiSearchService: APISearchService;
  private codeGenerationService: CodeGenerationService;
  private documentationIndexService: DocumentationIndexService;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.knowledgeBuilder = new KnowledgeBuilder();
    this.knowledgeRepository = new KnowledgeRepository();
    this.apiSearchService = new APISearchService();
    this.codeGenerationService = new CodeGenerationService();
    this.documentationIndexService = new DocumentationIndexService();
  }

  /**
   * Initialize the knowledge service and build knowledge graph
   */
  async initialize(specPath: string = '/spec'): Promise<void> {
    return startSpan('knowledge.initialize', async () => {
      // If already initialized, return immediately
      if (this.initialized) return;

      // If initialization is already in progress, wait for it to complete
      if (this.initializationPromise) {
        return this.initializationPromise;
      }

      // Start initialization and store the promise to prevent concurrent initializations
      this.initializationPromise = this.performInitialization(specPath);

      try {
        await this.initializationPromise;
      } catch (error) {
        // Reset the promise on failure so initialization can be retried
        this.initializationPromise = null;
        throw error;
      }
    });
  }

  /**
   * Perform the actual initialization work
   */
  private async performInitialization(specPath: string): Promise<void> {
    try {
      // Build knowledge graph from specifications
      const apiData =
        await this.knowledgeBuilder.buildFromSpecifications(specPath);

      // Store in repository
      await this.knowledgeRepository.store(apiData);

      // Initialize search service with API data
      await this.apiSearchService.initialize(apiData);

      // Initialize code generation service
      await this.codeGenerationService.initialize();

      // Initialize documentation index service with correct MDX path
      const mdxPath = specPath.endsWith('/spec')
        ? `${specPath}/mdx`
        : `${specPath}/spec/mdx`;
      await this.documentationIndexService.indexDocuments(mdxPath);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize KnowledgeService:', error);
      throw error;
    }
  }

  /**
   * Discover API methods and classes based on functionality description
   */
  async discoverAPI(
    functionality: string,
    language?: string
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    return startSpan('knowledge.discoverAPI', () =>
      this.apiSearchService.discoverAPI(functionality, language)
    );
  }

  /**
   * Search for API methods with optional class filtering
   */
  async searchApiMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    return startSpan('knowledge.searchApiMethods', () =>
      this.apiSearchService.searchApiMethods(query, className, limit)
    );
  }

  /**
   * Search for API classes with optional namespace filtering
   */
  async searchClasses(
    query: string,
    namespace?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    return startSpan('knowledge.searchClasses', () =>
      this.apiSearchService.searchClasses(query, namespace, limit)
    );
  }

  /**
   * Generate code based on goal and context
   */
  async generateCode(
    goal: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    this.ensureInitialized();
    return startSpan('knowledge.generateCode', () =>
      this.codeGenerationService.generateCompleteCode(goal, context)
    );
  }

  /**
   * Generate setup code for specific language and features
   */
  generateSetupCode(language: string, features: string[]): string {
    this.ensureInitialized();
    return this.codeGenerationService.generateSetupCode(language, features);
  }

  /**
   * Search documentation using semantic AI
   */
  async searchDocumentation(
    query: string,
    filters?: DocumentationSearchFilters,
    limit = 5
  ): Promise<DocumentationResult[]> {
    this.ensureInitialized();
    return startSpan('knowledge.searchDocs', () =>
      this.documentationIndexService.searchDocuments(query, filters, limit)
    );
  }

  /**
   * Get documentation by API method
   */
  async getDocumentationByAPI(
    apiMethod: string
  ): Promise<DocumentationResult[]> {
    this.ensureInitialized();
    return this.documentationIndexService.searchDocuments(
      apiMethod,
      undefined,
      5
    );
  }

  /**
   * Get getting started guide for specific language
   */
  async getGettingStartedGuide(
    language: string
  ): Promise<DocumentationResult | null> {
    this.ensureInitialized();
    const results = await this.documentationIndexService.searchDocuments(
      'getting started introduction',
      { language, category: 'getting-started' },
      1
    );
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get code examples for specific API method and language
   */
  async getCodeExamples(
    apiMethod: string,
    language: string
  ): Promise<CodeExample[]> {
    this.ensureInitialized();
    const results = await this.documentationIndexService.searchDocuments(
      apiMethod,
      { language, hasCodeExamples: true },
      5
    );

    const codeExamples: CodeExample[] = [];
    for (const result of results) {
      codeExamples.push(...result.codeExamples);
    }

    return codeExamples;
  }

  /**
   * Get documents by programming language
   */
  async getDocumentsByLanguage(
    language: string
  ): Promise<DocumentationResult[]> {
    this.ensureInitialized();
    return this.documentationIndexService.getDocumentsByLanguage(language);
  }

  /**
   * Get knowledge service statistics
   */
  getStats() {
    this.ensureInitialized();
    return {
      apiSearchStats: this.apiSearchService.getStats(),
      repositoryStats: this.knowledgeRepository.getStats(),
      documentationStats: this.documentationIndexService.getStats(),
      isInitialized: this.initialized,
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'KnowledgeService not initialized. Call initialize() first.'
      );
    }
  }
}
