/**
 * APIDiscoveryService - Handles API method and class discovery
 *
 * Provides intelligent discovery of PrivMX APIs based on functionality
 * descriptions, with support for different programming languages.
 */

import type { SearchResult, SearchContext } from '../../types/index.js';

export class APIDiscoveryService {
  private apiMethods: Map<string, any[]> = new Map();
  private apiClasses: Map<string, any[]> = new Map();
  private initialized = false;

  /**
   * Initialize the discovery service with API data
   */
  async initialize(apiData: Map<string, unknown>): Promise<void> {
    console.log('🔍 Initializing API Discovery Service...');

    this.apiMethods.clear();
    this.apiClasses.clear();

    // Process API data to build discovery indices
    for (const [key, value] of apiData.entries()) {
      if (Array.isArray(value)) {
        this.indexNamespaces(key, value);
      }
    }

    this.initialized = true;
    console.log(
      `✅ API Discovery Service initialized with ${this.apiMethods.size} method groups and ${this.apiClasses.size} class groups`
    );
  }

  /**
   * Discover API methods based on functionality description
   */
  async discoverAPI(
    functionality: string,
    language?: string
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const results: SearchResult[] = [];
    const searchTerms = this.extractSearchTerms(functionality);

    console.log(
      `🔎 Discovering APIs for: "${functionality}" (${language || 'any language'})`
    );

    // Search through indexed methods
    for (const [key, methods] of this.apiMethods.entries()) {
      // Filter by language if specified
      if (language && !key.toLowerCase().includes(language.toLowerCase())) {
        continue;
      }

      for (const method of methods) {
        const relevanceScore = this.calculateRelevanceScore(
          method,
          searchTerms,
          functionality
        );

        if (relevanceScore > 0.3) {
          // Threshold for relevance
          results.push({
            id: `${key}-${method.name}`,
            title: `${method.name} (${method.className || 'Function'})`,
            content: method.description || method.snippet || '',
            type: 'method',
            language: this.extractLanguageFromKey(key),
            namespace: method.namespace,
            score: relevanceScore,
            metadata: {
              methodType: method.methodType,
              className: method.className,
              parameters: method.parameters?.length || 0,
              prerequisites: method.prerequisites || [],
              usagePatterns: method.usagePatterns || [],
            },
          });
        }
      }
    }

    // Search through indexed classes
    for (const [key, classes] of this.apiClasses.entries()) {
      if (language && !key.toLowerCase().includes(language.toLowerCase())) {
        continue;
      }

      for (const apiClass of classes) {
        const relevanceScore = this.calculateRelevanceScore(
          apiClass,
          searchTerms,
          functionality
        );

        if (relevanceScore > 0.3) {
          results.push({
            id: `${key}-${apiClass.name}`,
            title: `${apiClass.name} (Class)`,
            content: apiClass.description || '',
            type: 'class',
            language: this.extractLanguageFromKey(key),
            namespace: apiClass.namespace,
            score: relevanceScore,
            metadata: {
              methodCount: apiClass.methods?.length || 0,
              staticMethods: apiClass.staticMethods?.length || 0,
              constructors: apiClass.constructors?.length || 0,
              dependencies: apiClass.dependencies || [],
              usedWith: apiClass.usedWith || [],
            },
          });
        }
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.score - a.score);

    console.log(`📊 Found ${results.length} relevant APIs`);
    return results.slice(0, 20); // Return top 20 results
  }

  /**
   * Get API recommendations based on context
   */
  async getRecommendations(context: SearchContext): Promise<SearchResult[]> {
    this.ensureInitialized();

    const recommendations: SearchResult[] = [];

    // Analyze context to suggest relevant APIs
    if (context.codeContext) {
      const codeAnalysis = this.analyzeCodeContext(context.codeContext);
      // Add logic to recommend APIs based on existing code
    }

    if (context.userLevel === 'beginner') {
      // Recommend simpler APIs for beginners
      recommendations.push(...this.getBeginnerFriendlyAPIs());
    }

    return recommendations;
  }

  /**
   * Find related APIs for a given API method or class
   */
  async findRelatedAPIs(apiName: string, limit = 5): Promise<SearchResult[]> {
    this.ensureInitialized();

    const results: SearchResult[] = [];

    // Find the target API
    const targetAPI = this.findAPIByName(apiName);
    if (!targetAPI) return results;

    // Find related APIs based on:
    // 1. Same namespace
    // 2. Dependencies
    // 3. Usage patterns
    // 4. Common workflows

    return results.slice(0, limit);
  }

  /**
   * Get API usage statistics
   */
  getStats() {
    return {
      totalMethods: Array.from(this.apiMethods.values()).reduce(
        (sum, methods) => sum + methods.length,
        0
      ),
      totalClasses: Array.from(this.apiClasses.values()).reduce(
        (sum, classes) => sum + classes.length,
        0
      ),
      methodGroups: this.apiMethods.size,
      classGroups: this.apiClasses.size,
      initialized: this.initialized,
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'APIDiscoveryService not initialized. Call initialize() first.'
      );
    }
  }

  private indexNamespaces(key: string, namespaces: any[]): void {
    const methods: any[] = [];
    const classes: any[] = [];

    for (const namespace of namespaces) {
      if (namespace.functions) {
        methods.push(...namespace.functions);
      }

      if (namespace.classes) {
        classes.push(...namespace.classes);

        // Also index methods from classes
        for (const apiClass of namespace.classes) {
          if (apiClass.methods) {
            methods.push(
              ...apiClass.methods.map((m: any) => ({
                ...m,
                className: apiClass.name,
              }))
            );
          }
          if (apiClass.staticMethods) {
            methods.push(
              ...apiClass.staticMethods.map((m: any) => ({
                ...m,
                className: apiClass.name,
              }))
            );
          }
        }
      }
    }

    if (methods.length > 0) {
      this.apiMethods.set(key, methods);
    }
    if (classes.length > 0) {
      this.apiClasses.set(key, classes);
    }
  }

  private extractSearchTerms(functionality: string): string[] {
    return functionality
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((term) => term.length > 2)
      .map((term) => term.trim());
  }

  private calculateRelevanceScore(
    item: any,
    searchTerms: string[],
    functionality: string
  ): number {
    let score = 0;
    const itemText =
      `${item.name} ${item.description || ''} ${JSON.stringify(item.usagePatterns || [])}`.toLowerCase();

    // Exact name matches get high score
    if (searchTerms.some((term) => item.name.toLowerCase().includes(term))) {
      score += 0.8;
    }

    // Description matches
    const descriptionMatches = searchTerms.filter((term) =>
      itemText.includes(term)
    );
    score += (descriptionMatches.length / searchTerms.length) * 0.6;

    // Functionality-specific bonuses
    if (
      functionality.includes('message') &&
      item.name.toLowerCase().includes('message')
    ) {
      score += 0.3;
    }
    if (
      functionality.includes('file') &&
      item.name.toLowerCase().includes('file')
    ) {
      score += 0.3;
    }
    if (
      functionality.includes('connect') &&
      item.name.toLowerCase().includes('connect')
    ) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  private extractLanguageFromKey(key: string): string {
    const parts = key.split('-');
    return parts[0] || 'unknown';
  }

  private analyzeCodeContext(code: string): any {
    // Simple code analysis - could be enhanced
    return {
      hasImports: code.includes('import'),
      hasAsync: code.includes('async'),
      hasPrivMX: code.includes('PrivMX') || code.includes('privmx'),
    };
  }

  private getBeginnerFriendlyAPIs(): SearchResult[] {
    // Return simpler APIs suitable for beginners
    return [];
  }

  private findAPIByName(name: string): any | null {
    for (const methods of this.apiMethods.values()) {
      const found = methods.find((m) => m.name === name);
      if (found) return found;
    }

    for (const classes of this.apiClasses.values()) {
      const found = classes.find((c) => c.name === name);
      if (found) return found;
    }

    return null;
  }
}
