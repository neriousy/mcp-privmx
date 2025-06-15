/**
 * Search Engine for API Knowledge Service
 * Handles indexing and searching of API documentation
 */

import { APINamespace, APIMethod, APIClass } from '../../api/types.js';
import { SearchResult } from '../../types/index.js';
// @ts-expect-error – wink-bm25 has no TS declarations yet
import bm25Factory from 'wink-bm25-text-search';
// @ts-expect-error – wink-tokenizer has no TS declarations yet
import winkTokenizer from 'wink-tokenizer';

// Select lexical scoring algorithm via env: bm25 (default) or tfidf
const TEXT_ALGO =
  process.env.TEXT_ALGO ||
  (process.env.USE_BM25 === 'false' ? 'tfidf' : 'bm25');

const USE_BM25 = TEXT_ALGO === 'bm25';

interface SearchStats {
  namespaces: number;
  methods: number;
  classes: number;
  languages: number;
  byType: Record<string, number>;
}

export class SearchEngine {
  // In-memory knowledge stores
  private apiIndex: Map<string, APINamespace> = new Map();
  private methodIndex: Map<string, APIMethod[]> = new Map();
  private classIndex: Map<string, APIClass[]> = new Map();
  private languageIndex: Map<string, APINamespace[]> = new Map();
  private keywordIndex: Map<string, SearchResult[]> = new Map();
  // BM25 engine & doc map (optional)
  private bm25 = USE_BM25 ? bm25Factory() : null;
  private docMap: Map<string, SearchResult> = new Map();

  constructor() {
    if (this.bm25) {
      const tokenizer = winkTokenizer();
      this.bm25.defineConfig({ fldWeights: { text: 1 } });
      this.bm25.definePrepTasks([
        (t: string) => t.toLowerCase(),
        tokenizer.tokenize,
      ]);
    }
  }

  /**
   * Clear all indices
   */
  clear(): void {
    this.apiIndex.clear();
    this.methodIndex.clear();
    this.classIndex.clear();
    this.languageIndex.clear();
    this.keywordIndex.clear();
    this.docMap.clear();
    if (this.bm25) {
      this.bm25.reset();
    }
  }

  /**
   * Add namespace to the knowledge graph
   */
  addNamespace(namespace: APINamespace, language: string): void {
    const key = `${language}:${namespace.name}`;
    this.apiIndex.set(key, namespace);

    // Add to language index
    if (!this.languageIndex.has(language)) {
      this.languageIndex.set(language, []);
    }
    this.languageIndex.get(language)?.push(namespace);
  }

  /**
   * Build search indices for fast lookup
   */
  buildIndices(): void {
    console.log('   🔍 Building search indices...');

    for (const [key, namespace] of this.apiIndex) {
      const [language] = key.split(':');

      // Index methods
      for (const method of namespace.functions) {
        this.indexMethod(method, language, namespace.name);
      }

      // Index class methods
      for (const apiClass of namespace.classes) {
        this.indexClass(apiClass, language, namespace.name);

        for (const method of apiClass.methods) {
          this.indexMethod(method, language, namespace.name, apiClass.name);
        }

        for (const method of apiClass.staticMethods) {
          this.indexMethod(method, language, namespace.name, apiClass.name);
        }

        for (const constructor of apiClass.constructors) {
          this.indexMethod(
            constructor,
            language,
            namespace.name,
            apiClass.name
          );
        }
      }
    }

    if (this.bm25) {
      this.bm25.consolidate();
    }
  }

  /**
   * Search for APIs by functionality description
   */
  search(functionality: string, language?: string): SearchResult[] {
    if (this.bm25) {
      const hits = this.bm25.search(functionality, 15);
      return hits
        .map(({ id, score }: { id: string; score: number }) => {
          const doc = this.docMap.get(id);
          if (!doc) return null;
          return { ...doc, score } as SearchResult;
        })
        .filter(Boolean)
        .filter((result: SearchResult) => {
          if (!language) return true;
          return this.isLanguageCompatible(
            language,
            result.metadata.language as string
          );
        })
        .slice(0, 10) as SearchResult[];
    }
    const words = functionality.toLowerCase().split(/\s+/);
    const results = new Map<string, SearchResult>();
    const scores = new Map<string, number>();

    for (const word of words) {
      if (word.length < 3) continue;

      const matches = this.keywordIndex.get(word) || [];

      for (const match of matches) {
        if (
          language &&
          !this.isLanguageCompatible(
            language,
            match.metadata.language as string
          )
        )
          continue;

        const id = match.id;
        if (!results.has(id)) {
          results.set(id, match);
          scores.set(id, 0);
        }

        scores.set(id, (scores.get(id) || 0) + 1);
      }
    }

    // Convert to array and sort by relevance
    const sortedResults = Array.from(results.values())
      .map((result) => ({
        ...result,
        score: (scores.get(result.id) || 0) / words.length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return sortedResults;
  }

  /**
   * Search for methods
   */
  searchMethods(query: string, className?: string, limit = 10): SearchResult[] {
    const results = this.search(query);
    return results
      .filter(
        (r) =>
          r.metadata.type === 'method' &&
          (!className || r.metadata.className === className)
      )
      .slice(0, limit);
  }

  /**
   * Search for classes
   */
  searchClasses(query: string, namespace?: string, limit = 10): SearchResult[] {
    const results = this.search(query);
    return results
      .filter(
        (r) =>
          r.metadata.type === 'class' &&
          (!namespace || r.metadata.namespace === namespace)
      )
      .slice(0, limit);
  }

  /**
   * Get statistics about indexed content
   */
  getStats(): SearchStats {
    const byType: Record<string, number> = {};

    for (const [, results] of this.keywordIndex) {
      for (const result of results) {
        const type = result.metadata.type as string;
        if (type) {
          byType[type] = (byType[type] || 0) + 1;
        }
      }
    }

    return {
      namespaces: this.apiIndex.size,
      methods: this.getTotalMethods(),
      classes: this.getTotalClasses(),
      languages: this.languageIndex.size,
      byType,
    };
  }

  /**
   * Index a method for search
   */
  private indexMethod(
    method: APIMethod,
    language: string,
    namespace: string,
    className?: string
  ): void {
    const methodKey = method.key;

    if (!this.methodIndex.has(methodKey)) {
      this.methodIndex.set(methodKey, []);
    }

    this.methodIndex.get(methodKey)?.push(method);

    // Add to keyword index
    const searchResult: SearchResult = {
      id: `method:${language}:${namespace}:${className || ''}:${method.name}`,
      title: `${method.name}${className ? ` (${className})` : ''}`,
      content: this.formatMethodForSearch(method, className),
      type: 'method',
      metadata: {
        type: 'method',
        namespace,
        language,
        title: `${method.name}${className ? ` (${className})` : ''}`,
        methodType: method.methodType,
        className,
      },
      score: 1.0,
    };

    this.addToKeywordIndex(method.name, searchResult);
    this.addToKeywordIndex(method.description, searchResult);

    if (className) {
      this.addToKeywordIndex(className, searchResult);
    }

    // BM25 doc
    this.docMap.set(searchResult.id, searchResult);
    if (this.bm25) {
      this.bm25.addDoc({ id: searchResult.id, text: searchResult.content });
    }
  }

  /**
   * Index a class for search
   */
  private indexClass(
    apiClass: APIClass,
    language: string,
    namespace: string
  ): void {
    const key = apiClass.name.toLowerCase();

    if (!this.classIndex.has(key)) {
      this.classIndex.set(key, []);
    }

    this.classIndex.get(key)?.push(apiClass);

    // Add to keyword index
    const searchResult: SearchResult = {
      id: `class:${language}:${namespace}:${apiClass.name}`,
      title: apiClass.name,
      content: this.formatClassForSearch(apiClass),
      type: 'class',
      metadata: {
        type: 'class',
        namespace,
        language,
        title: apiClass.name,
        className: apiClass.name,
      },
      score: 1.0,
    };

    this.addToKeywordIndex(apiClass.name, searchResult);
    this.addToKeywordIndex(apiClass.description || '', searchResult);

    // BM25 doc
    this.docMap.set(searchResult.id, searchResult);
    if (this.bm25) {
      this.bm25.addDoc({ id: searchResult.id, text: searchResult.content });
    }
  }

  /**
   * Add result to keyword index
   */
  private addToKeywordIndex(text: string, result: SearchResult): void {
    if (!text || typeof text !== 'string') {
      return; // Skip if text is undefined, null, or not a string
    }

    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (word.length < 3) continue; // Skip short words

      if (!this.keywordIndex.has(word)) {
        this.keywordIndex.set(word, []);
      }

      this.keywordIndex.get(word)?.push(result);
    }
  }

  /**
   * Format method for search display
   */
  private formatMethodForSearch(method: APIMethod, className?: string): string {
    const prefix = className ? `${className}.` : '';
    const params = method.parameters
      .map((p) => `${p.name}: ${p.type.name}`)
      .join(', ');
    const returns =
      method.returns.length > 0 ? ` -> ${method.returns[0].type.name}` : '';

    return `${prefix}${method.name}(${params})${returns}\n\n${method.description}`;
  }

  /**
   * Format class for search display
   */
  private formatClassForSearch(apiClass: APIClass): string {
    const methodCount =
      apiClass.methods.length +
      apiClass.staticMethods.length +
      apiClass.constructors.length;
    return `class ${apiClass.name}\n\n${apiClass.description}\n\nMethods: ${methodCount}`;
  }

  /**
   * Get total number of methods indexed
   */
  private getTotalMethods(): number {
    let total = 0;
    for (const methods of this.methodIndex.values()) {
      total += methods.length;
    }
    return total;
  }

  /**
   * Get total number of classes indexed
   */
  private getTotalClasses(): number {
    let total = 0;
    for (const classes of this.classIndex.values()) {
      total += classes.length;
    }
    return total;
  }

  /**
   * Check if languages are compatible for search results
   */
  private isLanguageCompatible(
    requestedLanguage: string,
    resultLanguage: string
  ): boolean {
    // Exact match
    if (requestedLanguage === resultLanguage) {
      return true;
    }

    // TypeScript is compatible with JavaScript
    if (requestedLanguage === 'typescript' && resultLanguage === 'javascript') {
      return true;
    }

    // JavaScript is compatible with TypeScript
    if (requestedLanguage === 'javascript' && resultLanguage === 'typescript') {
      return true;
    }

    // Java and Kotlin are compatible
    if (
      (requestedLanguage === 'java' && resultLanguage === 'kotlin') ||
      (requestedLanguage === 'kotlin' && resultLanguage === 'java')
    ) {
      return true;
    }

    // C# and .NET languages
    if (
      (requestedLanguage === 'csharp' && resultLanguage === 'dotnet') ||
      (requestedLanguage === 'dotnet' && resultLanguage === 'csharp')
    ) {
      return true;
    }

    return false;
  }
}
