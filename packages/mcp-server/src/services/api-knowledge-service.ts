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
import { EnhancedSearchEngine } from './search/enhanced-search-engine.js';
import {
  createCodeGenerator,
  getSupportedLanguages,
  isLanguageSupported,
} from './code-generators/index.js';
import { WorkflowGeneratorFactory } from './feature-generators/workflow-generator-factory.js';
import { SmartTemplateEngine } from './template-engine/smart-template-engine.js';
import { InteractiveWorkflowBuilder } from './workflow-builder/interactive-workflow-builder.js';
import { ReactAdapter } from './framework-adapters/react-adapter.js';
import {
  SearchResult,
  CodeGenerationOptions,
  APIKnowledgeServiceConfig,
  DocumentationStats,
  IndexingResult,
  EnhancedSearchResult,
  SearchContext,
  WorkflowSuggestion,
  NextStepSuggestion,
  CodeContext,
  GeneratedCode,
  SkillLevel,
  ProjectType,
} from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PlopTemplateEngine,
  WebCompatibleTemplateEngine,
  JSCodeshiftTransformer,
  InquirerWorkflowBuilder,
  PrivMXIntelligenceEngine,
} from '../integrations/index.js';
import type {
  TemplateGenerationRequest,
  CodeTransformationRequest,
  WorkflowBuildRequest,
  PrivMXIntelligenceRequest,
  IntegrationResult,
} from '../integrations/types.js';

/**
 * Modular API Knowledge Service
 */
export class APIKnowledgeService {
  private config: APIKnowledgeServiceConfig;
  private apiParser: APIParser;
  private documentProcessor: DocumentProcessor;
  private searchEngine: SearchEngine;
  private enhancedSearchEngine: EnhancedSearchEngine;
  private workflowGenerator: WorkflowGeneratorFactory;
  private smartTemplateEngine: SmartTemplateEngine;
  private interactiveWorkflowBuilder: InteractiveWorkflowBuilder;

  // NEW: Integration layer with proven tools
  private plopTemplateEngine: PlopTemplateEngine | WebCompatibleTemplateEngine;
  private jscodeshiftTransformer: JSCodeshiftTransformer;
  private inquirerWorkflowBuilder: InquirerWorkflowBuilder;
  private privmxIntelligenceEngine: PrivMXIntelligenceEngine;

  private apiData: Map<string, any> = new Map();
  private initialized = false;

  constructor(config: APIKnowledgeServiceConfig) {
    this.config = config;
    this.apiParser = new APIParser();
    this.documentProcessor = new DocumentProcessor();
    this.searchEngine = new SearchEngine();
    this.enhancedSearchEngine = new EnhancedSearchEngine();
    this.workflowGenerator = new WorkflowGeneratorFactory();
    this.smartTemplateEngine = new SmartTemplateEngine();
    this.interactiveWorkflowBuilder = new InteractiveWorkflowBuilder();

    // Initialize integration layer with proven tools
    // Use web-compatible template engine in webpack environments to avoid Handlebars issues
    const isWebpack =
      typeof window !== 'undefined' || process.env.WEBPACK === 'true';
    this.plopTemplateEngine = isWebpack
      ? new WebCompatibleTemplateEngine()
      : new PlopTemplateEngine();
    this.jscodeshiftTransformer = new JSCodeshiftTransformer();
    this.inquirerWorkflowBuilder = new InquirerWorkflowBuilder();
    this.privmxIntelligenceEngine = new PrivMXIntelligenceEngine();

    // Register framework adapters
    this.smartTemplateEngine.registerFrameworkAdapter(
      'react',
      new ReactAdapter()
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🏗️ Building API knowledge graph...');

    try {
      await this.buildKnowledgeGraph();
      this.searchEngine.buildIndices();

      // Initialize enhanced search engine with API data
      await this.enhancedSearchEngine.initialize(this.apiData);

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
   * Enhanced API Intelligence Methods
   */

  /**
   * Enhanced context-aware search
   */
  async searchWithContext(
    query: string,
    context?: SearchContext
  ): Promise<EnhancedSearchResult[]> {
    if (!this.initialized) await this.initialize();
    return this.enhancedSearchEngine.searchWithContext(query, context);
  }

  /**
   * Find complete workflows for a goal
   */
  async findWorkflowsForGoal(
    goal: string,
    language?: string
  ): Promise<WorkflowSuggestion[]> {
    if (!this.initialized) await this.initialize();
    return this.enhancedSearchEngine.findWorkflowsForGoal(goal, language);
  }

  /**
   * Suggest next steps based on current code
   */
  async suggestNextSteps(
    currentCode: string,
    language: string
  ): Promise<NextStepSuggestion[]> {
    if (!this.initialized) await this.initialize();
    return this.enhancedSearchEngine.suggestNextSteps(currentCode, language);
  }

  /**
   * Generate complete working code for a use case
   */
  async generateCompleteCode(
    goal: string,
    context: CodeContext
  ): Promise<GeneratedCode> {
    if (!this.initialized) await this.initialize();
    try {
      return this.enhancedSearchEngine.generateCompleteCode(goal, context);
    } catch (error) {
      console.error('Failed to generate complete code:', error);
      // Fallback to basic code generation
      return {
        code: this.generateBasicCode(goal, context.language),
        imports: ['@simplito/privmx-webendpoint'],
        dependencies: ['@simplito/privmx-webendpoint'],
        explanation: `Basic ${context.language} implementation for: ${goal}`,
        warnings: [
          'This is a basic implementation. Consider adding error handling and validation.',
        ],
        nextSteps: [
          'Add proper error handling',
          'Implement user interface',
          'Add data validation',
        ],
      };
    }
  }

  private generateBasicCode(goal: string, language: string): string {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('messag') || goalLower.includes('chat')) {
      return this.generateBasicMessagingCode(language);
    }

    if (goalLower.includes('file') || goalLower.includes('store')) {
      return this.generateBasicFileCode(language);
    }

    return this.generateBasicSetupCode(language);
  }

  private generateBasicMessagingCode(language: string): string {
    if (language === 'javascript' || language === 'typescript') {
      return `
// Basic PrivMX Messaging Setup
import { Endpoint } from '@simplito/privmx-webendpoint';

class BasicMessaging {
  async initialize(userPrivKey, solutionId, bridgeUrl) {
    try {
      await Endpoint.setup("/public");
      const connection = await Endpoint.connect(userPrivKey, solutionId, bridgeUrl);
      const threadApi = await Endpoint.createThreadApi(connection);
      
      return { connection, threadApi };
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }
  
  async createThread(threadApi, contextId, users) {
    return await threadApi.createThread(
      contextId,
      users,
      users, // managers same as users
      Buffer.from("Thread metadata"),
      Buffer.from(JSON.stringify({ name: "Chat Thread" }))
    );
  }
  
  async sendMessage(threadApi, threadId, message) {
    return await threadApi.sendMessage(
      threadId,
      Buffer.from("message"),
      Buffer.from(JSON.stringify({ timestamp: Date.now() })),
      Buffer.from(message)
    );
  }
}
`;
    }

    return `// Basic ${language} messaging implementation\n// Setup, connection, and messaging code here`;
  }

  private generateBasicFileCode(language: string): string {
    if (language === 'javascript' || language === 'typescript') {
      return `
// Basic PrivMX File Storage Setup
import { Endpoint } from '@simplito/privmx-webendpoint';

class BasicFileStorage {
  async initialize(userPrivKey, solutionId, bridgeUrl) {
    try {
      await Endpoint.setup("/public");
      const connection = await Endpoint.connect(userPrivKey, solutionId, bridgeUrl);
      const storeApi = await Endpoint.createStoreApi(connection);
      
      return { connection, storeApi };
    } catch (error) {
      console.error('Failed to initialize:', error);
      throw error;
    }
  }
  
  async createStore(storeApi, contextId, users) {
    return await storeApi.createStore(
      contextId,
      users,
      users, // managers same as users
      Buffer.from("Store metadata"),
      Buffer.from(JSON.stringify({ name: "File Store" }))
    );
  }
  
  async uploadFile(storeApi, storeId, fileName, fileData) {
    return await storeApi.createFile(
      storeId,
      Buffer.from(fileName),
      Buffer.from("file metadata"),
      Buffer.from(fileData)
    );
  }
}
`;
    }

    return `// Basic ${language} file storage implementation\n// Setup, connection, and file operations code here`;
  }

  private generateBasicSetupCode(language: string): string {
    if (language === 'javascript' || language === 'typescript') {
      return `
// Basic PrivMX Setup
import { Endpoint } from '@simplito/privmx-webendpoint';

class BasicPrivMXSetup {
  async initialize(userPrivKey, solutionId, bridgeUrl) {
    try {
      // Initialize the endpoint
      await Endpoint.setup("/public");
      
      // Establish connection
      const connection = await Endpoint.connect(userPrivKey, solutionId, bridgeUrl);
      
      console.log('PrivMX connection established successfully');
      return connection;
    } catch (error) {
      console.error('Failed to establish connection:', error);
      throw error;
    }
  }
}
`;
    }

    return `// Basic ${language} PrivMX setup\n// Connection and initialization code here`;
  }

  /**
   * Analyze and debug user's existing code
   */
  async analyzeCode(
    code: string,
    language: string,
    errorMessage?: string
  ): Promise<{
    issues: string[];
    suggestions: string[];
    fixes: string[];
    improvedCode?: string;
  }> {
    if (!this.initialized) await this.initialize();

    const issues: string[] = [];
    const suggestions: string[] = [];
    const fixes: string[] = [];

    const codeLower = code.toLowerCase();

    // Check for common PrivMX setup issues
    if (!codeLower.includes('endpoint.setup')) {
      issues.push('Missing Endpoint.setup() call');
      fixes.push('Add: await Endpoint.setup("/public");');
    }

    if (
      codeLower.includes('endpoint.setup') &&
      !codeLower.includes('endpoint.connect')
    ) {
      issues.push('Setup called but no connection established');
      fixes.push(
        'Add: const connection = await Endpoint.connect(userPrivKey, solutionId, bridgeUrl);'
      );
    }

    if (errorMessage) {
      if (errorMessage.toLowerCase().includes('connection')) {
        suggestions.push('Check your bridge URL, solution ID, and private key');
        suggestions.push(
          'Ensure the PrivMX Bridge is accessible from your network'
        );
      }

      if (errorMessage.toLowerCase().includes('permission')) {
        suggestions.push(
          'Verify user has proper permissions for this operation'
        );
        suggestions.push(
          'Check if the user is included in the context users list'
        );
      }
    }

    // Suggest improvements
    if (!codeLower.includes('try') && !codeLower.includes('catch')) {
      suggestions.push('Add error handling with try-catch blocks');
    }

    if (!codeLower.includes('eventqueue') && codeLower.includes('thread')) {
      suggestions.push(
        'Consider adding real-time event listeners for better UX'
      );
    }

    return { issues, suggestions, fixes };
  }

  /**
   * Phase 2: Smart Template Engine Methods
   */

  /**
   * Generate code from smart templates with context awareness
   */
  async generateFromTemplate(
    templateId: string,
    context: CodeContext,
    options?: {
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
      projectType?: 'prototype' | 'production' | 'learning';
      customizations?: Record<string, any>;
    }
  ): Promise<GeneratedCode> {
    if (!this.initialized) await this.initialize();

    return this.smartTemplateEngine.generateFromTemplate(templateId, context);
  }

  /**
   * Get all available smart templates
   */
  getSmartTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    supportedFrameworks: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    return this.smartTemplateEngine.getAvailableTemplates();
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): Array<{
    id: string;
    name: string;
    description: string;
    supportedFrameworks: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    return this.smartTemplateEngine.getTemplatesByCategory(category);
  }

  /**
   * Generate complete project structure from template
   */
  async generateProjectFromTemplate(
    templateId: string,
    projectName: string,
    context: CodeContext,
    options?: {
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
      projectType?: 'prototype' | 'production' | 'learning';
      includeTests?: boolean;
      includeDocumentation?: boolean;
    }
  ): Promise<{
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
    instructions: string[];
    nextSteps: string[];
  }> {
    if (!this.initialized) await this.initialize();

    return this.smartTemplateEngine.generateProjectStructure(
      templateId,
      projectName,
      context,
      this.mapSkillLevel(options?.skillLevel) || SkillLevel.INTERMEDIATE,
      this.mapProjectType(options?.projectType) || ProjectType.WEB_APP,
      {
        includeTests: options?.includeTests || false,
        includeDocumentation: options?.includeDocumentation || true,
      }
    );
  }

  /**
   * Phase 2: Interactive Workflow Builder Methods
   */

  /**
   * Start an interactive development session
   */
  async startInteractiveSession(
    goal: string,
    userContext: {
      skillLevel: 'beginner' | 'intermediate' | 'advanced';
      preferredLanguage: string;
      frameworks?: string[];
      projectType?: 'prototype' | 'production' | 'learning';
    }
  ): Promise<{
    sessionId: string;
    currentStep: number;
    totalSteps: number;
    nextAction: {
      type:
        | 'template_selection'
        | 'code_generation'
        | 'validation'
        | 'completion';
      description: string;
      options?: any[];
    };
  }> {
    return this.interactiveWorkflowBuilder.startSession(goal, userContext);
  }

  /**
   * Continue interactive session with user response
   */
  async continueInteractiveSession(
    sessionId: string,
    userResponse: any
  ): Promise<{
    currentStep: number;
    totalSteps: number;
    nextAction: {
      type:
        | 'template_selection'
        | 'code_generation'
        | 'validation'
        | 'completion';
      description: string;
      options?: any[];
      result?: any;
    };
    isComplete: boolean;
  }> {
    return this.interactiveWorkflowBuilder.processUserResponse(
      sessionId,
      userResponse
    );
  }

  /**
   * Get session progress and status
   */
  getSessionStatus(sessionId: string): {
    currentStep: number;
    totalSteps: number;
    progress: number;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    generatedFiles: Array<{
      path: string;
      description: string;
      status: 'pending' | 'generated' | 'validated';
    }>;
  } {
    return this.interactiveWorkflowBuilder.getSessionStatus(sessionId);
  }

  /**
   * Pause an interactive session (can be resumed later)
   */
  pauseInteractiveSession(sessionId: string): boolean {
    return this.interactiveWorkflowBuilder.pauseSession(sessionId);
  }

  /**
   * Resume a paused interactive session
   */
  resumeInteractiveSession(sessionId: string): boolean {
    return this.interactiveWorkflowBuilder.resumeSession(sessionId);
  }

  /**
   * Cancel an interactive session
   */
  cancelInteractiveSession(sessionId: string): boolean {
    return this.interactiveWorkflowBuilder.cancelSession(sessionId);
  }

  /**
   * Get all active sessions (for session management)
   */
  getActiveSessions(): Array<{
    sessionId: string;
    goal: string;
    startedAt: Date;
    currentStep: number;
    totalSteps: number;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
  }> {
    const sessions = this.interactiveWorkflowBuilder.getActiveSessions();
    return sessions.map((session) => ({
      sessionId: session.id,
      goal: session.goal,
      startedAt: session.startTime,
      currentStep: session.currentStep,
      totalSteps: session.steps.length,
      status: session.status as 'active' | 'paused' | 'completed' | 'cancelled',
    }));
  }

  /**
   * Generate code for specific workflow step
   */
  async generateStepCode(
    sessionId: string,
    stepIndex: number
  ): Promise<{
    code: string;
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
    instructions: string[];
    validationResults?: {
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    };
  }> {
    return this.interactiveWorkflowBuilder.generateStepCode(
      sessionId,
      stepIndex
    );
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

          // Store for enhanced search engine
          const key = `${language}:${namespace.name}`;
          this.apiData.set(key, namespace);
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

  private mapSkillLevel(
    skillLevel?: 'beginner' | 'intermediate' | 'advanced'
  ): SkillLevel | undefined {
    if (!skillLevel) return undefined;
    switch (skillLevel) {
      case 'beginner':
        return SkillLevel.BEGINNER;
      case 'intermediate':
        return SkillLevel.INTERMEDIATE;
      case 'advanced':
        return SkillLevel.EXPERT;
      default:
        return undefined;
    }
  }

  private mapProjectType(
    projectType?: 'prototype' | 'production' | 'learning'
  ): ProjectType | undefined {
    if (!projectType) return undefined;
    switch (projectType) {
      case 'prototype':
        return ProjectType.WEB_APP; // Map to closest available type
      case 'production':
        return ProjectType.WEB_APP; // Map to closest available type
      case 'learning':
        return ProjectType.WEB_APP; // Map to closest available type
      default:
        return undefined;
    }
  }

  // ========================================
  // NEW: Integration Layer MCP Tools
  // Using proven tools + PrivMX intelligence
  // ========================================

  /**
   * Generate complete PrivMX application using Plop.js + our intelligence
   */
  async generatePrivMXApp(request: {
    templateId: string;
    projectName: string;
    framework: 'react' | 'vue' | 'vanilla' | 'nodejs';
    language: 'javascript' | 'typescript';
    features: string[];
    privmxConfig: {
      solutionId?: string;
      platformUrl?: string;
      apiEndpoints: string[];
    };
    userContext: {
      skillLevel: 'beginner' | 'intermediate' | 'expert';
      preferences?: Record<string, any>;
    };
  }): Promise<
    IntegrationResult<{ files: Array<{ path: string; content: string }> }>
  > {
    const templateRequest: TemplateGenerationRequest = {
      templateId: request.templateId,
      projectName: request.projectName,
      framework: request.framework,
      language: request.language,
      features: request.features,
      privmxConfig: request.privmxConfig,
      userContext: request.userContext,
    };

    // Handle different interface signatures between PlopTemplateEngine and WebCompatibleTemplateEngine
    if ('generateTemplates' in this.plopTemplateEngine) {
      // WebCompatibleTemplateEngine uses generateTemplates method
      return (this.plopTemplateEngine as any).generateTemplates(
        templateRequest
      );
    } else {
      // PlopTemplateEngine uses generateFromTemplate method
      return this.plopTemplateEngine.generateFromTemplate(templateRequest);
    }
  }

  /**
   * Transform existing code with PrivMX integration using jscodeshift
   */
  async transformCodeWithPrivMX(request: {
    sourceCode: string;
    transformation:
      | 'add-privmx-integration'
      | 'upgrade-sdk'
      | 'add-security-patterns';
    targetFramework?: string;
    options?: Record<string, any>;
  }): Promise<IntegrationResult<{ transformedCode: string }>> {
    const transformRequest: CodeTransformationRequest = {
      sourceCode: request.sourceCode,
      transformation: request.transformation,
      targetFramework: request.targetFramework,
      options: request.options,
    };

    return this.jscodeshiftTransformer.transformCode(transformRequest);
  }

  /**
   * Start interactive workflow using Inquirer.js + PrivMX intelligence
   */
  async startInteractivePrivMXWorkflow(request: {
    goal: string;
    userContext: {
      skillLevel: 'beginner' | 'intermediate' | 'expert';
      preferredFramework?: string;
      projectType?: 'prototype' | 'production' | 'learning';
    };
  }): Promise<IntegrationResult<{ sessionId: string; firstStep: any }>> {
    const workflowRequest: WorkflowBuildRequest = {
      goal: request.goal,
      userContext: request.userContext,
    };

    return this.inquirerWorkflowBuilder.startWorkflow(workflowRequest);
  }

  /**
   * Continue interactive workflow session
   */
  async continuePrivMXWorkflow(
    sessionId: string,
    answers: any
  ): Promise<
    IntegrationResult<{
      nextStep?: any;
      isComplete: boolean;
      generatedFiles?: string[];
    }>
  > {
    return this.inquirerWorkflowBuilder.continueWorkflow(sessionId, answers);
  }

  /**
   * Get PrivMX intelligence insights
   */
  async getPrivMXIntelligence(request: {
    query: string;
    type:
      | 'api-relationship'
      | 'workflow-suggestion'
      | 'pattern-validation'
      | 'optimization';
    context?: {
      apis?: string[];
      framework?: string;
      codeSnippet?: string;
    };
  }): Promise<IntegrationResult<any>> {
    const intelligenceRequest: PrivMXIntelligenceRequest = {
      query: request.query,
      type: request.type,
      context: request.context,
    };

    return this.privmxIntelligenceEngine.processIntelligenceRequest(
      intelligenceRequest
    );
  }

  /**
   * Get available templates from Plop integration
   */
  async getAvailablePrivMXTemplates(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      frameworks: string[];
      features: string[];
    }>
  > {
    const templates = await this.plopTemplateEngine.getAvailableTemplates();

    // Handle different return types from different template engines
    if (Array.isArray(templates) && templates.length > 0) {
      if (typeof templates[0] === 'string') {
        // WebCompatibleTemplateEngine returns string[]
        return (templates as string[]).map((templateName) => ({
          id: templateName,
          name: templateName,
          description: `PrivMX ${templateName} template`,
          frameworks: ['react', 'vue', 'vanilla', 'nodejs'],
          features: ['messaging', 'file-sharing', 'notifications'],
        }));
      } else {
        // PlopTemplateEngine returns objects with name, description, path
        return (
          templates as Array<{
            name: string;
            description: string;
            path: string;
          }>
        ).map((template) => ({
          id: template.name,
          name: template.name,
          description: template.description,
          frameworks: ['react', 'vue', 'vanilla', 'nodejs'],
          features: ['messaging', 'file-sharing', 'notifications'],
        }));
      }
    }

    // Fallback for empty arrays
    return [];
  }

  /**
   * Get available code transformations from jscodeshift integration
   */
  getAvailableCodeTransformations(): Array<{
    id: string;
    name: string;
    description: string;
    frameworks: string[];
  }> {
    return this.jscodeshiftTransformer.getAvailableTransformations();
  }

  /**
   * Get workflow session status from Inquirer integration
   */
  getPrivMXWorkflowStatus(sessionId: string): any {
    return this.inquirerWorkflowBuilder.getSessionStatus(sessionId);
  }

  /**
   * Validate PrivMX code patterns using our intelligence
   */
  async validatePrivMXCode(
    code: string,
    context?: {
      framework?: string;
      apis?: string[];
    }
  ): Promise<IntegrationResult<any>> {
    return this.privmxIntelligenceEngine.processIntelligenceRequest({
      query: code,
      type: 'pattern-validation',
      context: {
        framework: context?.framework,
        codeSnippet: code,
        apis: context?.apis,
      },
    });
  }

  /**
   * Get optimization suggestions using our intelligence
   */
  async getPrivMXOptimizations(
    code: string,
    context?: {
      framework?: string;
      apis?: string[];
    }
  ): Promise<IntegrationResult<any>> {
    return this.privmxIntelligenceEngine.processIntelligenceRequest({
      query: code,
      type: 'optimization',
      context: {
        framework: context?.framework,
        codeSnippet: code,
        apis: context?.apis,
      },
    });
  }

  /**
   * Analyze API relationships using our intelligence
   */
  async analyzePrivMXAPIRelationships(
    apiQuery: string,
    context?: {
      framework?: string;
      apis?: string[];
    }
  ): Promise<IntegrationResult<any>> {
    return this.privmxIntelligenceEngine.processIntelligenceRequest({
      query: apiQuery,
      type: 'api-relationship',
      context,
    });
  }

  /**
   * Get workflow suggestions using our intelligence
   */
  async getPrivMXWorkflowSuggestions(
    goal: string,
    context?: {
      framework?: string;
      apis?: string[];
    }
  ): Promise<IntegrationResult<any>> {
    return this.privmxIntelligenceEngine.processIntelligenceRequest({
      query: goal,
      type: 'workflow-suggestion',
      context,
    });
  }
}
