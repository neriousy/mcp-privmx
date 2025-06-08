/**
 * API Knowledge Service - Refactored Modular Version
 *
 * This service builds an in-memory knowledge graph from PrivMX APIs
 * and provides fast, deterministic search and code generation capabilities.
 *
 * No vector embeddings or semantic search - just structured data lookup.
 */

import { APIParser } from '../api/parser.js';
import { DocumentProcessor } from '../loaders/document-processor.js';
import { SearchEngine } from './search/search-engine.js';
import {
  createCodeGenerator,
  getSupportedLanguages,
  isLanguageSupported,
} from './code-generators/index.js';
import { WorkflowGeneratorFactory } from './feature-generators/workflow-generator-factory.js';
import {
  SearchResult,
  CodeGenerationOptions,
  APIKnowledgeServiceConfig,
  DocumentationStats,
  IndexingResult,
} from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Modular API Knowledge Service
 */
export class APIKnowledgeService {
  private config: APIKnowledgeServiceConfig;
  private apiParser: APIParser;
  private documentProcessor: DocumentProcessor;
  private searchEngine: SearchEngine;
  private workflowGenerator: WorkflowGeneratorFactory;
  private initialized = false;

  constructor(config: APIKnowledgeServiceConfig) {
    this.config = config;
    this.apiParser = new APIParser();
    this.documentProcessor = new DocumentProcessor();
    this.searchEngine = new SearchEngine();
    this.workflowGenerator = new WorkflowGeneratorFactory();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🏗️ Building API knowledge graph...');

    try {
      await this.buildKnowledgeGraph();
      this.searchEngine.buildIndices();
      this.initialized = true;

      const stats = this.searchEngine.getStats();
      console.log('✅ API knowledge graph ready!');
      console.log(`   📊 ${stats.namespaces} namespaces indexed`);
      console.log(`   🔧 ${stats.methods} methods indexed`);
      console.log(`   📋 ${stats.classes} classes indexed`);
      console.log(`   🌍 ${stats.languages} languages supported`);
    } catch (error) {
      console.error('❌ Failed to build knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Search for APIs by functionality description
   */
  async discoverAPI(
    functionality: string,
    language?: string
  ): Promise<SearchResult[]> {
    return this.searchEngine.search(functionality, language);
  }

  /**
   * Generate setup code for a specific language
   */
  public generateSetupCode(language: string, features: string[]): string {
    if (!isLanguageSupported(language)) {
      throw new Error(
        `Language '${language}' is not supported. Supported languages: ${getSupportedLanguages().join(', ')}`
      );
    }

    const generator = createCodeGenerator(language);
    return generator.generateSetup(features);
  }

  /**
   * Generate complete workflow application
   */
  async generateWorkflow(
    templateId: string,
    language: string,
    features?: string[],
    customizations?: Record<string, any>
  ): Promise<any> {
    return this.workflowGenerator.generateWorkflow({
      template: templateId,
      language,
      features,
      customizations,
    });
  }

  /**
   * Get all available workflow templates
   */
  getWorkflowTemplates(): any[] {
    return this.workflowGenerator.getAvailableTemplates();
  }

  /**
   * Get workflow templates by category
   */
  getWorkflowTemplatesByCategory(category: string): any[] {
    return this.workflowGenerator.getTemplatesByCategory(category);
  }

  /**
   * Get a specific workflow template
   */
  getWorkflowTemplate(templateId: string): any {
    return this.workflowGenerator.getTemplate(templateId);
  }

  /**
   * Legacy interface compatibility methods
   */
  async searchDocumentation(
    query: string,
    filters?: { type?: string; namespace?: string },
    limit = 5
  ): Promise<SearchResult[]> {
    return this.discoverAPI(query, filters?.namespace);
  }

  async searchApiMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return this.searchEngine.searchMethods(query, className, limit);
  }

  async searchClasses(
    query: string,
    namespace?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return this.searchEngine.searchClasses(query, namespace, limit);
  }

  async searchGuides(query: string, limit = 10): Promise<SearchResult[]> {
    // For now, return empty - guides will be handled separately
    return [];
  }

  async getRelatedContent(content: string, limit = 5): Promise<SearchResult[]> {
    // Extract key terms and search
    const terms = content.split(/\s+/).slice(0, 5).join(' ');
    return this.discoverAPI(terms);
  }

  async indexDocumentation(
    path = '/spec',
    force = false
  ): Promise<IndexingResult> {
    console.log(`📚 Re-indexing from: ${path} (force: ${force})`);

    if (force) {
      this.searchEngine.clear();
      this.initialized = false;
    }

    await this.initialize();

    const stats = this.searchEngine.getStats();
    return {
      indexed: stats.namespaces,
      updated: 0,
      errors: 0,
    };
  }

  async search(
    query: string,
    options?: { type?: string; namespace?: string; limit?: number }
  ): Promise<SearchResult[]> {
    return this.searchDocumentation(query, options, options?.limit);
  }

  async searchMethods(
    query: string,
    className?: string,
    limit = 10
  ): Promise<SearchResult[]> {
    return this.searchApiMethods(query, className, limit);
  }

  async clearCollection(): Promise<void> {
    console.log('🗑️ Clearing API knowledge graph');
    this.searchEngine.clear();
    this.initialized = false;
  }

  async processDirectory(path: string): Promise<IndexingResult> {
    return this.indexDocumentation(path, false);
  }

  async processAndStoreDocuments(files: string[]): Promise<IndexingResult> {
    console.log(`📄 Processing ${files.length} specific documents`);
    // For now, just trigger full re-index
    return this.indexDocumentation();
  }

  async getDocumentationStats(): Promise<DocumentationStats> {
    const stats = this.searchEngine.getStats();
    return {
      total: stats.namespaces,
      byType: stats.byType,
    };
  }

  /**
   * Private implementation methods
   */
  private async buildKnowledgeGraph(): Promise<void> {
    const specPath = this.config.specPath || 'spec';

    // Find all JSON API files
    const apiFiles = await this.findAPIFiles(specPath);

    for (const apiFile of apiFiles) {
      try {
        console.log(`   📄 Processing: ${apiFile}`);

        // Determine language from file path
        const language = this.extractLanguageFromPath(apiFile);

        // Load and parse the API file
        const content = await fs.readFile(apiFile, 'utf-8');
        const namespaces = await this.apiParser.parseAPISpec(
          content,
          language,
          apiFile
        );

        // Store in knowledge graph
        for (const namespace of namespaces) {
          this.searchEngine.addNamespace(namespace, language);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to process ${apiFile}:`, error);
      }
    }
  }

  private async findAPIFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && entry.name !== 'node_modules') {
            await walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            // Only include JSON files that look like API specs
            if (fullPath.includes('api') || fullPath.includes('spec')) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Cannot read directory ${dir}:`, error);
      }
    };

    await walkDir(basePath);
    return files;
  }

  private extractLanguageFromPath(filePath: string): string {
    const pathParts = filePath.split(path.sep);

    // Look for language indicators in path
    for (const part of pathParts) {
      if (
        ['js', 'javascript', 'typescript', 'ts'].includes(part.toLowerCase())
      ) {
        return 'javascript';
      }
      if (['java', 'kotlin'].includes(part.toLowerCase())) {
        return 'java';
      }
      if (['swift'].includes(part.toLowerCase())) {
        return 'swift';
      }
      if (['cpp', 'c++', 'cxx'].includes(part.toLowerCase())) {
        return 'cpp';
      }
      if (['csharp', 'c#', 'cs'].includes(part.toLowerCase())) {
        return 'csharp';
      }
    }

    return 'javascript'; // Default
  }

  // Workflow generation stubs (to be moved to separate modules)
  private generateSecureMessagingWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// Secure Messaging Workflow for ${language}
// Implementation coming soon`;
  }

  private generateFileSharingWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// File Sharing Workflow for ${language}
// Implementation coming soon`;
  }

  private generateDataStorageWorkflow(
    language: string,
    options: CodeGenerationOptions
  ): string {
    return `// Data Storage Workflow for ${language}
// Implementation coming soon`;
  }
}
