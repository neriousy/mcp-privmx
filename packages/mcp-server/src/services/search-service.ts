import { SearchEngine } from './search/search-engine.js';
import { EnhancedSearchEngine } from './search/enhanced-search-engine.js';
import {
  SearchResult,
  SearchContext,
  EnhancedSearchResult,
  WorkflowSuggestion,
  NextStepSuggestion,
  CodeContext,
  GeneratedCode,
} from './types.js';
import { APINamespace } from '../api/types.js';

export class SearchService {
  private searchEngine: SearchEngine;
  private enhancedSearchEngine: EnhancedSearchEngine;
  private initialized = false;

  constructor() {
    this.searchEngine = new SearchEngine();
    this.enhancedSearchEngine = new EnhancedSearchEngine();
  }

  public async initialize(apiData: Map<string, unknown>): Promise<void> {
    if (this.initialized) return;

    this.searchEngine.buildIndices();
    await this.enhancedSearchEngine.initialize(apiData);
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
    return this.enhancedSearchEngine.searchWithContext(query, context);
  }

  public async findWorkflowsForGoal(
    goal: string,
    language?: string
  ): Promise<WorkflowSuggestion[]> {
    return this.enhancedSearchEngine.findWorkflowsForGoal(goal, language);
  }

  public async suggestNextSteps(
    currentCode: string,
    language: string
  ): Promise<NextStepSuggestion[]> {
    return this.enhancedSearchEngine.suggestNextSteps(currentCode, language);
  }

  public async generateCompleteCode(
    goal: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    return this.enhancedSearchEngine.generateCompleteCode(goal, context);
  }
}
