/**
 * API Search Service
 *
 * Focused service for searching PrivMX API documentation, methods, and classes.
 * Extracted from the large APIKnowledgeService for better separation of concerns.
 */

import logger from '../../common/logger.js';
import { SearchService } from '../search/search-service.js';
import {
  SearchResult,
  EnhancedSearchResult,
  SearchContext,
  WorkflowSuggestion,
  NextStepSuggestion,
} from '../../types/index.js';
import { ApiVectorService } from '../search/api-vector-service.js';
import { setSpanAttributes, startSpan } from '../../common/otel.js';

export class APISearchService {
  private searchService: SearchService;
  private apiData: Map<string, unknown>;
  private initialized = false;
  private apiVectorService: ApiVectorService;

  constructor() {
    this.searchService = new SearchService();
    this.apiData = new Map();
    this.apiVectorService = new ApiVectorService();
  }

  /**
   * Initialize the search service with API data
   */
  async initialize(apiData: Map<string, unknown>): Promise<void> {
    if (this.initialized) return;

    logger.info('🔍 Initializing API search service...');

    this.apiData = apiData;
    await this.searchService.initialize(apiData);
    await this.apiVectorService.initialize(apiData);
    this.initialized = true;

    const stats = this.searchService.getStats();
    logger.info('✅ API search service ready!');
    logger.info(`   📊 ${stats.namespaces} namespaces indexed`);
    logger.info(`   🔧 ${stats.methods} methods indexed`);
    logger.info(`   📋 ${stats.classes} classes indexed`);
  }

  /**
   * Search for APIs by functionality description
   */
  async discoverAPI(
    functionality: string,
    language?: string
  ): Promise<SearchResult[]> {
    this.ensureInitialized();
    return this.hybridSearch(functionality, language);
  }

  /**
   * Search PrivMX documentation with optional filters
   */
  async searchDocumentation(
    query: string,
    filters?: { type?: string; namespace?: string },
    limit = 5
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    logger.info(`🔍 Searching documentation for: "${query}"`);

    // Use the search service to find relevant documentation
    const results = await this.searchService.search(query, filters?.type);

    // Filter by namespace if specified
    const filteredResults = filters?.namespace
      ? results.filter((result) => {
          const namespace = result.metadata.namespace;
          return (
            typeof namespace === 'string' &&
            namespace.toLowerCase().includes(filters.namespace!.toLowerCase())
          );
        })
      : results;

    return filteredResults.slice(0, limit);
  }

  /**
   * Search for specific API methods and endpoints
   */
  async searchApiMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    logger.info(`🔧 Searching API methods for: "${query}"`);

    // Search for methods, prioritizing those in the specified class
    const results = await this.searchService.search(query);

    // Filter by class name if specified
    const filteredResults = className
      ? results.filter((result) => {
          const resultClassName = result.metadata.className;
          return (
            typeof resultClassName === 'string' &&
            resultClassName.toLowerCase().includes(className.toLowerCase())
          );
        })
      : results;

    // Prioritize actual method results
    const methodResults = filteredResults.filter(
      (result) =>
        result.metadata.type === 'method' ||
        result.metadata.methodType === 'method'
    );

    return methodResults.slice(0, limit);
  }

  /**
   * Search for API classes
   */
  async searchClasses(
    query: string,
    namespace?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    logger.info(`📋 Searching classes for: "${query}"`);

    const results = await this.searchService.search(query);

    // Filter for class results
    const classResults = results.filter(
      (result) => result.metadata.type === 'class'
    );

    // Filter by namespace if specified
    const filteredResults = namespace
      ? classResults.filter((result) => {
          const resultNamespace = result.metadata.namespace;
          return (
            typeof resultNamespace === 'string' &&
            resultNamespace.toLowerCase().includes(namespace.toLowerCase())
          );
        })
      : classResults;

    return filteredResults.slice(0, limit);
  }

  /**
   * Enhanced context-aware search
   */
  async searchWithContext(
    query: string,
    context?: SearchContext
  ): Promise<EnhancedSearchResult[]> {
    this.ensureInitialized();

    logger.info(`🎯 Context-aware search for: "${query}"`);

    // Delegate to search service if it has this method
    if (typeof this.searchService.searchWithContext === 'function') {
      return this.searchService.searchWithContext(query, context);
    }

    // Basic implementation if not available
    const basicResults = await this.searchService.search(query);

    // Convert to enhanced results with basic relevance scoring
    const enhancedResults: EnhancedSearchResult[] = basicResults.map(
      (result) => ({
        ...result,
        relatedApis: [],
        usagePatterns: [],
        complexityScore: 1,
        prerequisites: [],
        codeExamples: [],
        contextScore: this.calculateRelevanceScore(result, context),
      })
    );

    // Sort by relevance score
    enhancedResults.sort(
      (a, b) => (b.contextScore || 0) - (a.contextScore || 0)
    );

    return enhancedResults;
  }

  /**
   * Search for guides and tutorials
   */
  async searchGuides(query: string, limit = 10): Promise<SearchResult[]> {
    this.ensureInitialized();

    logger.info(`📚 Searching guides for: "${query}"`);

    const results = await this.searchService.search(query);

    // Filter for guide/tutorial content
    const guideResults = results.filter(
      (result) =>
        result.metadata.type === 'guide' ||
        result.metadata.type === 'tutorial' ||
        result.metadata.type === 'mdx' ||
        result.content.toLowerCase().includes('guide') ||
        result.content.toLowerCase().includes('tutorial')
    );

    return guideResults.slice(0, limit);
  }

  /**
   * Get content related to a given piece of content
   */
  async getRelatedContent(content: string, limit = 5): Promise<SearchResult[]> {
    this.ensureInitialized();

    // Extract key terms from the content for search
    const keyTerms = this.extractKeyTerms(content);
    const searchQuery = keyTerms.join(' ');

    const results = await this.searchService.search(searchQuery);

    // Filter out exact matches and return related content
    const relatedResults = results.filter(
      (result) => !result.content.includes(content.substring(0, 100))
    );

    return relatedResults.slice(0, limit);
  }

  /**
   * Find workflows for a specific goal
   */
  async findWorkflowsForGoal(
    goal: string,
    language?: string
  ): Promise<WorkflowSuggestion[]> {
    this.ensureInitialized();

    // Delegate to search service if available
    if (typeof this.searchService.findWorkflowsForGoal === 'function') {
      return this.searchService.findWorkflowsForGoal(goal, language);
    }

    // Basic implementation
    const results = await this.searchService.search(
      `${goal} workflow ${language || ''}`
    );

    // Convert to workflow suggestions
    return results.slice(0, 3).map((result, index) => ({
      id: `workflow-${index}`,
      name: result.title,
      description: result.content.substring(0, 200),
      steps: [], // Would need more complex logic to extract steps
      estimatedTime: '30 minutes',
      difficulty: 'intermediate' as const,
      tags: [goal, language || 'general'].filter(Boolean),
    }));
  }

  /**
   * Suggest next steps based on current code
   */
  async suggestNextSteps(
    currentCode: string,
    language: string
  ): Promise<NextStepSuggestion[]> {
    this.ensureInitialized();

    // Delegate to search service if available
    if (typeof this.searchService.suggestNextSteps === 'function') {
      return this.searchService.suggestNextSteps(currentCode, language);
    }

    // Basic implementation - analyze code and suggest improvements
    const suggestions: NextStepSuggestion[] = [];

    // Simple heuristics for common next steps
    if (currentCode.includes('import') && !currentCode.includes('export')) {
      suggestions.push({
        action: 'Add export statements',
        reason: "Code imports modules but doesn't export anything",
        priority: 'medium',
      });
    }

    if (currentCode.includes('fetch') && !currentCode.includes('catch')) {
      suggestions.push({
        action: 'Add error handling',
        reason: 'Network requests should have error handling',
        priority: 'high',
        codeExample: 'try { ... } catch (error) { console.error(error); }',
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        action: 'Add comments and documentation',
        reason: 'Improve code readability and maintainability',
        priority: 'low',
      });
    }

    return suggestions;
  }

  /**
   * General search with options
   */
  async search(
    query: string,
    options?: { type?: string; namespace?: string; limit?: number }
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const results = await this.hybridSearch(query, options?.type);

    // Apply additional filters
    let filteredResults = results;

    if (options?.namespace) {
      filteredResults = filteredResults.filter((result) => {
        const namespace = result.metadata.namespace;
        return (
          typeof namespace === 'string' &&
          namespace.toLowerCase().includes(options.namespace!.toLowerCase())
        );
      });
    }

    return filteredResults.slice(0, options?.limit || 10);
  }

  /**
   * Get search statistics
   */
  getStats() {
    return this.searchService.getStats();
  }

  /**
   * Private helper methods
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'APISearchService not initialized. Call initialize() first.'
      );
    }
  }

  private calculateRelevanceScore(
    result: SearchResult,
    context?: SearchContext
  ): number {
    let score = 1.0;

    // Boost score for language match
    if (context?.language && result.metadata.language === context.language) {
      score += 0.3;
    }

    // Boost score for framework match
    if (context?.framework && result.metadata.framework === context.framework) {
      score += 0.2;
    }

    return score;
  }

  private extractKeyTerms(content: string): string[] {
    // Simple key term extraction
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    // Remove common words and return unique terms
    const commonWords = [
      'this',
      'that',
      'with',
      'from',
      'they',
      'have',
      'been',
      'will',
    ];
    const keyTerms = words.filter((word) => !commonWords.includes(word));

    return [...new Set(keyTerms)].slice(0, 5);
  }

  private async hybridSearch(
    query: string,
    language?: string
  ): Promise<SearchResult[]> {
    const lexicalWeight = Number(process.env.API_TEXT_WEIGHT ?? '0.5');
    const vectorWeight = Number(
      process.env.API_VECTOR_WEIGHT ?? 1 - lexicalWeight
    );

    return startSpan('api.hybridSearch', async () => {
      // Lexical (BM25/text-only) – avoid counting vector score twice
      const lexicalResults = this.searchService.lexicalSearch(query, language);

      // Semantic
      const semanticRes = await this.apiVectorService.semanticSearch(query, 20);

      // Normalise lexical scores 0..1
      const maxLex = lexicalResults.length > 0 ? lexicalResults[0].score : 1;
      const combined = new Map<string, { res: SearchResult; score: number }>();

      for (const r of lexicalResults) {
        const norm = r.score / (maxLex || 1);
        combined.set(r.id, { res: r, score: norm * lexicalWeight });
      }

      for (const s of semanticRes) {
        const existing = combined.get(s.id);
        if (existing) {
          existing.score += s.score * vectorWeight;
        } else {
          // Need to fetch SearchResult for this ID
          const lex = lexicalResults.find((r) => r.id === s.id);
          if (lex)
            combined.set(lex.id, { res: lex, score: s.score * vectorWeight });
        }
      }

      const sorted = Array.from(combined.values())
        .sort((a, b) => b.score - a.score)
        .map((c) => c.res);

      setSpanAttributes({
        textWeight: lexicalWeight,
        vectorWeight,
        lexicalCandidates: lexicalResults.length,
        semanticCandidates: semanticRes.length,
      });

      return sorted.slice(0, 10);
    });
  }
}
