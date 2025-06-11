/**
 * KnowledgeRepository - Handles data persistence and retrieval for knowledge graph
 *
 * Provides a clean interface for storing and accessing the processed
 * PrivMX API knowledge data.
 */

export class KnowledgeRepository {
  private knowledgeData: Map<string, unknown> = new Map();
  private indexedData: Map<string, any[]> = new Map();
  private stats: {
    totalEntries: number;
    lastUpdated: Date | null;
    languages: Set<string>;
  } = {
    totalEntries: 0,
    lastUpdated: null,
    languages: new Set(),
  };

  /**
   * Store processed API data in the repository
   */
  async store(apiData: Map<string, unknown>): Promise<void> {
    try {
      console.log('💾 Storing knowledge data in repository...');

      // Clear existing data
      this.knowledgeData.clear();
      this.indexedData.clear();
      this.stats.languages.clear();

      // Store the API data
      for (const [key, value] of apiData.entries()) {
        this.knowledgeData.set(key, value);

        // Extract language for stats
        const language = key.split('-')[0];
        this.stats.languages.add(language);

        // Create searchable index
        this.indexEntry(key, value);
      }

      // Update stats
      this.stats.totalEntries = this.knowledgeData.size;
      this.stats.lastUpdated = new Date();

      console.log(
        `✅ Stored ${this.stats.totalEntries} knowledge entries for ${this.stats.languages.size} languages`
      );
    } catch (error) {
      console.error('❌ Failed to store knowledge data:', error);
      throw error;
    }
  }

  /**
   * Retrieve all stored knowledge data
   */
  getAll(): Map<string, unknown> {
    return new Map(this.knowledgeData);
  }

  /**
   * Retrieve knowledge data by key
   */
  get(key: string): unknown | undefined {
    return this.knowledgeData.get(key);
  }

  /**
   * Search for entries by pattern
   */
  search(pattern: string): Array<{ key: string; value: unknown }> {
    const results: Array<{ key: string; value: unknown }> = [];
    const searchLower = pattern.toLowerCase();

    for (const [key, value] of this.knowledgeData.entries()) {
      if (key.toLowerCase().includes(searchLower)) {
        results.push({ key, value });
      }
    }

    return results;
  }

  /**
   * Get entries for a specific language
   */
  getByLanguage(language: string): Array<{ key: string; value: unknown }> {
    const results: Array<{ key: string; value: unknown }> = [];
    const languagePrefix = language.toLowerCase();

    for (const [key, value] of this.knowledgeData.entries()) {
      if (key.toLowerCase().startsWith(languagePrefix)) {
        results.push({ key, value });
      }
    }

    return results;
  }

  /**
   * Check if repository has data for a specific language
   */
  hasLanguage(language: string): boolean {
    return this.stats.languages.has(language.toLowerCase());
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.stats.languages);
  }

  /**
   * Get repository statistics
   */
  getStats() {
    return {
      totalEntries: this.stats.totalEntries,
      lastUpdated: this.stats.lastUpdated,
      supportedLanguages: Array.from(this.stats.languages),
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.knowledgeData.clear();
    this.indexedData.clear();
    this.stats = {
      totalEntries: 0,
      lastUpdated: null,
      languages: new Set(),
    };
  }

  /**
   * Check if repository is empty
   */
  isEmpty(): boolean {
    return this.knowledgeData.size === 0;
  }

  /**
   * Create searchable index for an entry
   */
  private indexEntry(key: string, value: unknown): void {
    // Simple indexing - could be enhanced with more sophisticated search
    const indexKey = key.toLowerCase();

    if (!this.indexedData.has(indexKey)) {
      this.indexedData.set(indexKey, []);
    }

    this.indexedData.get(indexKey)?.push(value);
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): string {
    const jsonSize = JSON.stringify(
      Array.from(this.knowledgeData.entries())
    ).length;
    const sizeInMB = (jsonSize / (1024 * 1024)).toFixed(2);
    return `${sizeInMB} MB`;
  }
}
