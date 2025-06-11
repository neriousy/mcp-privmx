import { SearchEngine } from './basic-search-engine.js';
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

export class SearchService {
  private searchEngine: SearchEngine;
  private workflowSearchEngine: WorkflowSearchEngine;
  private initialized = false;

  constructor() {
    this.searchEngine = new SearchEngine();
    this.workflowSearchEngine = new WorkflowSearchEngine();
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
    return this.searchEngine.search(query, language);
  }

  public async searchMethods(
    query: string,
    className?: string
  ): Promise<SearchResult[]> {
    return this.searchEngine.searchMethods(query, className);
  }

  public async searchClasses(
    query: string,
    namespace?: string
  ): Promise<SearchResult[]> {
    return this.searchEngine.searchClasses(query, namespace);
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
}
