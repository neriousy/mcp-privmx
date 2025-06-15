import { SearchEngine } from './core-search-engine.js';
import { WorkflowSearchEngine } from './workflow-search-engine.js';
import {
  SearchResult,
  SearchContext,
  EnhancedSearchResult,
  WorkflowSuggestion,
  NextStepSuggestion,
  CodeContext,
  GeneratedCode,
} from '../../types/index.js';
import { APINamespace } from '../../api/types.js';
import eventBus from '../../common/event-bus.js';
import { startSpan } from '../../common/otel.js';
import { ApiVectorService } from './api-vector-service.js';
import { searchDuration, searchCounter } from '../../common/metrics.js';

export class SearchService {
  private searchEngine: SearchEngine;
  private workflowSearchEngine: WorkflowSearchEngine;
  private apiVectorService: ApiVectorService;
  private initialized = false;

  constructor() {
    this.searchEngine = new SearchEngine();
    this.workflowSearchEngine = new WorkflowSearchEngine();
    this.apiVectorService = new ApiVectorService();
  }

  public async initialize(apiData: Map<string, unknown>): Promise<void> {
    if (this.initialized) return;

    console.log('   🔍 Building search indices...');

    // Populate search engine with API data
    for (const [key, data] of apiData) {
      const [language] = key.split('-');
      if (language && data && typeof data === 'object') {
        // Handle both single namespace and array of namespaces
        const namespaces = Array.isArray(data) ? data : [data];

        for (const namespace of namespaces) {
          if (namespace && typeof namespace === 'object') {
            this.searchEngine.addNamespace(namespace as APINamespace, language);
          }
        }
      }
    }

    this.searchEngine.buildIndices();
    await this.workflowSearchEngine.initialize(apiData);
    await this.apiVectorService.initialize(apiData);
    this.initialized = true;
  }

  public getStats(): {
    namespaces: number;
    methods: number;
    classes: number;
    languages: number;
    byType: Record<string, number>;
  } {
    return this.searchEngine.getStats();
  }

  public addNamespace(namespace: APINamespace, language: string): void {
    this.searchEngine.addNamespace(namespace, language);
  }

  public clear(): void {
    this.searchEngine.clear();
    this.initialized = false;
  }

  public async search(
    query: string,
    language?: string
  ): Promise<SearchResult[]> {
    return startSpan('search.generic', async () => {
      eventBus.emit('search.started', { query, language });
      const start = Date.now();
      const results = await this.hybridSearch(query, language);
      const duration = Date.now() - start;
      searchCounter.inc({ type: 'generic' });
      searchDuration.observe({ type: 'generic' }, duration);
      eventBus.emit('search.completed', {
        query,
        language,
        resultsCount: results.length,
      });
      return results;
    });
  }

  public async searchMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return startSpan('search.methods', async () => {
      eventBus.emit('search.started', { query, type: 'methods', className });
      const start = Date.now();

      // Use hybrid search first, then filter method results
      const hybrid = await this.hybridSearch(query, undefined, limit * 2);

      const filtered = hybrid.filter((r) => {
        const isMethod =
          r.metadata.type === 'method' || r.metadata.methodType === 'method';
        const classMatch = className
          ? r.metadata.className === className
          : true;
        return isMethod && classMatch;
      });

      const results = filtered.slice(0, limit);

      const duration = Date.now() - start;
      searchCounter.inc({ type: 'methods' });
      searchDuration.observe({ type: 'methods' }, duration);

      eventBus.emit('search.completed', {
        query,
        type: 'methods',
        resultsCount: results.length,
      });
      return results;
    });
  }

  public async searchClasses(
    query: string,
    namespace?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return startSpan('search.classes', async () => {
      eventBus.emit('search.started', { query, type: 'classes', namespace });
      const start = Date.now();

      const hybrid = await this.hybridSearch(query, undefined, limit * 2);

      const filtered = hybrid.filter((r) => {
        const isClass = r.metadata.type === 'class';
        const nsMatch = namespace ? r.metadata.namespace === namespace : true;
        return isClass && nsMatch;
      });

      const results = filtered.slice(0, limit);

      const duration = Date.now() - start;
      searchCounter.inc({ type: 'classes' });
      searchDuration.observe({ type: 'classes' }, duration);

      eventBus.emit('search.completed', {
        query,
        type: 'classes',
        resultsCount: results.length,
      });
      return results;
    });
  }

  public async searchWithContext(
    query: string,
    context?: SearchContext
  ): Promise<EnhancedSearchResult[]> {
    return this.workflowSearchEngine.searchWithContext(query, context);
  }

  public async findWorkflowsForGoal(
    goal: string,
    language?: string
  ): Promise<WorkflowSuggestion[]> {
    return this.workflowSearchEngine.findWorkflowsForGoal(goal, language);
  }

  public async suggestNextSteps(
    currentCode: string,
    language: string
  ): Promise<NextStepSuggestion[]> {
    return this.workflowSearchEngine.suggestNextSteps(currentCode, language);
  }

  public async generateCompleteCode(
    goal: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    return this.workflowSearchEngine.generateCompleteCode(goal, context);
  }

  /**
   * Perform a pure lexical search (BM25 or keyword). Exposed for consumers that want
   * to apply their own hybrid logic (e.g. ApiSearchService).
   */
  public lexicalSearch(query: string, language?: string): SearchResult[] {
    return this.searchEngine.search(query, language);
  }

  /**
   * Hybrid search – combine lexical & vector scores using configurable weights.
   */
  private async hybridSearch(
    query: string,
    language?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    // Obtain lexical candidates
    const lexicalResults = this.lexicalSearch(query, language);

    // Semantic candidates (if available)
    const semanticRes = await this.apiVectorService.semanticSearch(query, 20);

    const lexicalWeight = Number(process.env.API_TEXT_WEIGHT ?? '0.5');
    const vectorWeight = Number(
      process.env.API_VECTOR_WEIGHT ?? 1 - lexicalWeight
    );

    // Normalise lexical scores 0..1 based on best hit
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
        const lex = lexicalResults.find((r) => r.id === s.id);
        if (lex) {
          combined.set(lex.id, { res: lex, score: s.score * vectorWeight });
        } else {
          // Handle purely semantic matches - create stub SearchResult from available data
          let title = `Semantic Match: ${s.id}`;
          const content = '';
          let type: 'api' | 'guide' | 'example' | 'class' | 'method' = 'api';
          const metadata: Record<string, unknown> = { source: 'vector_search' };

          // Extract information from the ID if it follows a pattern
          if (s.id.includes(':')) {
            const parts = s.id.split(':');
            if (parts[0] === 'class') {
              type = 'class';
              title = parts[2] || parts[1] || s.id;
              metadata.namespace = parts[1];
              metadata.className = parts[2];
            } else if (parts.length >= 2) {
              type = 'method';
              title = parts[parts.length - 1] || s.id;
              metadata.namespace = parts[0];
            }
          }

          const semanticResult: SearchResult = {
            id: s.id,
            title,
            content,
            type,
            score: s.score,
            metadata,
          };

          combined.set(s.id, {
            res: semanticResult,
            score: s.score * vectorWeight,
          });
        }
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .map((c) => c.res)
      .slice(0, limit);
  }
}
