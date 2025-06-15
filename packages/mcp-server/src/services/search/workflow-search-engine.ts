/**
 * Enhanced Search Engine with Context-Aware API Intelligence
 *
 * Extends the basic search engine with relationship graphs, context awareness,
 * and intelligent workflow suggestions.
 */

import { SearchEngine } from './core-search-engine.js';
import { APIAnalysisService } from '../api/api-analysis-service.js';
import { ApiVectorService } from './api-vector-service.js';
import {
  SearchResult,
  EnhancedSearchResult,
  SearchContext,
  WorkflowSuggestion,
  NextStepSuggestion,
  CodeContext,
  GeneratedCode,
  CodeExample,
} from '../../types/index.js';
import {
  createMessagingWorkflow,
  createFileStorageWorkflow,
  createInboxWorkflow,
  createEventHandlingWorkflow,
} from './workflow-templates.js';

interface CodeGeneratorOutput {
  main: string;
  imports: string[];
  dependencies: string[];
  warnings: string[];
}

interface CodeGenerator {
  generateFromWorkflow: (
    workflow: WorkflowSuggestion,
    context: CodeContext
  ) => CodeGeneratorOutput;
}

export class WorkflowSearchEngine extends SearchEngine {
  private relationshipAnalyzer: APIAnalysisService;
  /** Semantic vector search for API entities */
  private apiVectorService: ApiVectorService;
  private contextCache: Map<string, EnhancedSearchResult[]> = new Map();

  constructor() {
    super();
    this.relationshipAnalyzer = new APIAnalysisService();
    this.apiVectorService = new ApiVectorService();
  }

  /**
   * Initialize with relationship analysis
   */
  async initialize(apiData: Map<string, unknown>): Promise<void> {
    console.log('🧠 Building enhanced search intelligence...');

    // Build relationship graph from API data
    for (const [key, namespace] of apiData) {
      const [language] = key.split(':');
      this.relationshipAnalyzer.analyzeNamespace(namespace as never, language);
    }

    const stats = this.relationshipAnalyzer.getStats();
    console.log(
      `   🔗 ${stats.methodsWithPrerequisites} methods with prerequisites`
    );
    console.log(`   📋 ${stats.commonPatterns} common patterns identified`);
    console.log(`   ⚠️  ${stats.errorPatterns} error patterns catalogued`);

    // Initialize vector search
    try {
      await this.apiVectorService.initialize(apiData);
    } catch {
      /* ignore unavailable vector store */
    }
  }

  /**
   * Enhanced search with context awareness
   */
  async searchWithContext(
    query: string,
    context?: SearchContext
  ): Promise<EnhancedSearchResult[]> {
    const cacheKey = `${query}:${JSON.stringify(context)}`;

    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey) || [];
    }

    // Hybrid search results for better relevance
    const basicResults = await this.hybridSearch(
      query,
      context?.userContext?.language
    );

    // Enhance results with context intelligence
    const enhancedResults = basicResults.map((result) =>
      this.enhanceSearchResult(result, context)
    );

    // Sort by context relevance
    enhancedResults.sort((a, b) => {
      const scoreA = this.calculateContextScore(a, context);
      const scoreB = this.calculateContextScore(b, context);
      return scoreB - scoreA;
    });

    // Cache results
    this.contextCache.set(cacheKey, enhancedResults);

    return enhancedResults.slice(0, 10);
  }

  /**
   * Find complete workflows for a given goal
   */
  findWorkflowsForGoal(goal: string, language?: string): WorkflowSuggestion[] {
    const workflows: WorkflowSuggestion[] = [];

    // Analyze goal to determine workflow type
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('messag') || goalLower.includes('chat')) {
      workflows.push(this.createMessagingWorkflow(language));
    }

    if (
      goalLower.includes('file') ||
      goalLower.includes('upload') ||
      goalLower.includes('store')
    ) {
      workflows.push(this.createFileStorageWorkflow());
    }

    if (goalLower.includes('inbox') || goalLower.includes('notification')) {
      workflows.push(this.createInboxWorkflow());
    }

    if (
      goalLower.includes('event') ||
      goalLower.includes('realtime') ||
      goalLower.includes('listen')
    ) {
      workflows.push(this.createEventHandlingWorkflow());
    }

    return workflows;
  }

  /**
   * Suggest next steps based on current code
   */
  suggestNextSteps(
    currentCode: string,
    language: string
  ): NextStepSuggestion[] {
    const suggestions: NextStepSuggestion[] = [];
    const codeLower = currentCode.toLowerCase();

    // Analyze current code state
    if (!codeLower.includes('endpoint.setup')) {
      suggestions.push({
        action: 'Initialize PrivMX Endpoint',
        reason: 'Endpoint setup is required before any PrivMX operations',
        priority: 'high',
        codeExample: this.generateSetupCode(language),
      });
    }

    if (
      codeLower.includes('endpoint.setup') &&
      !codeLower.includes('endpoint.connect')
    ) {
      suggestions.push({
        action: 'Establish Connection',
        reason: 'Connection to PrivMX Bridge is required',
        priority: 'high',
        codeExample: this.generateConnectionCode(language),
      });
    }

    if (
      codeLower.includes('createthread') &&
      !codeLower.includes('sendmessage')
    ) {
      suggestions.push({
        action: 'Send Message to Thread',
        reason: 'You have created a thread, now you can send messages',
        priority: 'medium',
        codeExample: this.generateMessageCode(language),
      });
    }

    if (codeLower.includes('connect') && !codeLower.includes('eventqueue')) {
      suggestions.push({
        action: 'Set up Event Handling',
        reason: 'Add real-time event listeners for better user experience',
        priority: 'low',
        codeExample: this.generateEventHandlingCode(language),
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate complete working code for a specific use case
   */
  generateCompleteCode(goal: string, context: CodeContext): GeneratedCode {
    const { language, targetFramework } = context;

    // Find matching workflow
    const workflows = this.findWorkflowsForGoal(goal, language);
    if (workflows.length === 0) {
      throw new Error(`No workflow found for goal: ${goal}`);
    }

    const workflow = workflows[0];

    // Generate complete code based on workflow
    const codeGenerator = this.createCodeGenerator(language, targetFramework);
    const code = codeGenerator.generateFromWorkflow(workflow, context);

    return {
      code: code.main,
      imports: code.imports,
      dependencies: code.dependencies,
      explanation: this.generateExplanation(workflow),
      warnings: code.warnings,
      nextSteps: this.generateNextSteps(workflow),
    };
  }

  /**
   * Enhance search result with context intelligence
   */
  private enhanceSearchResult(
    result: SearchResult,
    context?: SearchContext
  ): EnhancedSearchResult {
    const methodKey = result.id;
    const errorHandlers = this.relationshipAnalyzer.getErrorPatterns(methodKey);

    return {
      ...result,
      relatedApis: this.findRelatedMethods(methodKey),
      usagePatterns: [],
      complexityScore: this.calculateComplexityScore(result),
      prerequisites: this.relationshipAnalyzer.getPrerequisites(methodKey),
      codeExamples: this.generateTypedCodeExamples(
        result,
        context?.userContext?.language
      ),
      contextScore: this.calculateContextScore(result, context),
      completeness: this.calculateCompleteness(result),
      relatedMethods: this.findRelatedMethods(methodKey),
      errorPatterns: errorHandlers.map((handler) => handler.errorType),
    };
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextScore(
    result: SearchResult | EnhancedSearchResult,
    context?: SearchContext
  ): number {
    let score = 0;

    // Language preference
    if (context?.userContext?.language === result.metadata.language) {
      score += 2;
    }

    // Framework match
    if (context?.userContext?.targetFramework) {
      const framework = context.userContext.targetFramework.toLowerCase();
      if (result.content.toLowerCase().includes(framework)) {
        score += 1;
      }
    }

    // Skill level appropriateness
    if (context?.userSkillLevel) {
      // Convert to SearchResult if needed for complexity estimation
      const searchResult = result as SearchResult;

      const complexity = this.estimateComplexity(searchResult);
      if (context.userSkillLevel === 'beginner' && complexity === 'low')
        score += 1;
      if (context.userSkillLevel === 'intermediate' && complexity === 'medium')
        score += 1;
      if (context.userSkillLevel === 'advanced' && complexity === 'high')
        score += 1;
    }

    return score;
  }

  /**
   * Calculate result completeness
   */
  private calculateCompleteness(result: SearchResult): number {
    let completeness = 0.5; // Base score

    if (result.content.length > 200) completeness += 0.2;
    if (result.content.includes('example') || result.content.includes('code'))
      completeness += 0.2;
    if (result.metadata.type === 'method') completeness += 0.1;

    return Math.min(completeness, 1.0);
  }

  /**
   * Create messaging workflow
   */
  private createMessagingWorkflow(_language?: string): WorkflowSuggestion {
    return createMessagingWorkflow();
  }

  /**
   * Create workflow for other use cases
   */
  private createFileStorageWorkflow(): WorkflowSuggestion {
    return createFileStorageWorkflow();
  }

  private createInboxWorkflow(): WorkflowSuggestion {
    return createInboxWorkflow();
  }

  private createEventHandlingWorkflow(): WorkflowSuggestion {
    return createEventHandlingWorkflow();
  }

  // Helper methods for code generation
  private generateSetupCode(language: string): string {
    return language === 'javascript' || language === 'typescript'
      ? 'await Endpoint.setup("/public");'
      : 'Endpoint.setup("/public");';
  }

  private generateConnectionCode(language: string): string {
    return language === 'javascript' || language === 'typescript'
      ? 'const connection = await Endpoint.connect(userPrivKey, solutionId, bridgeUrl);'
      : 'Connection connection = Endpoint.connect(userPrivKey, solutionId, bridgeUrl);';
  }

  private generateMessageCode(language: string): string {
    return language === 'javascript' || language === 'typescript'
      ? 'await threadApi.sendMessage(threadId, publicMeta, privateMeta, messageData);'
      : 'threadApi.sendMessage(threadId, publicMeta, privateMeta, messageData);';
  }

  private generateEventHandlingCode(language: string): string {
    return language === 'javascript' || language === 'typescript'
      ? 'const eventQueue = await Endpoint.getEventQueue();\neventQueue.addEventListener("threadNewMessage", handleMessage);'
      : 'EventQueue eventQueue = Endpoint.getEventQueue();\neventQueue.addEventListener("threadNewMessage", this::handleMessage);';
  }

  private findRelatedMethods(methodKey: string): string[] {
    const graph = this.relationshipAnalyzer.getRelationshipGraph();

    // 1. Prerequisites
    const prereqs = graph.prerequisites.get(methodKey) || [];

    // 2. Common patterns (Workflow steps sharing the same prerequisites)
    const patternSteps = graph.commonPatterns.get(methodKey) || [];
    const patternApis = patternSteps.map((p) => p.apiMethod);

    // 3. Usage frequency – choose top frequent APIs in same namespace
    const usageSorted = Array.from(graph.usageFrequency.entries())
      .filter(([k]) => k !== methodKey)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    const combined = new Set<string>([
      ...prereqs,
      ...patternApis,
      ...usageSorted,
    ]);

    return Array.from(combined).slice(0, 5);
  }

  private generateCodeExamples(
    result: SearchResult,
    language?: string
  ): CodeExample[] {
    if (!language) return [];

    const methodName = result.title.split(' ')[0];
    const className = result.metadata.className as string | undefined;
    const callExpr = className
      ? `${className}.${methodName}()`
      : `${methodName}()`;

    let snippet: string;
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        snippet = `// ${result.title}\nawait ${callExpr};`;
        break;
      case 'java':
        snippet = `// ${result.title}\n${callExpr};`;
        break;
      case 'csharp':
        snippet = `// ${result.title}\nawait ${callExpr};`;
        break;
      default:
        snippet = `// Usage for ${callExpr}`;
    }

    return [
      {
        language,
        code: snippet,
        description: `Basic usage of ${result.title}`,
        difficulty: 'beginner' as const,
      },
    ];
  }

  private estimateComplexity(result: SearchResult): 'low' | 'medium' | 'high' {
    const content = result.content.toLowerCase();
    if (content.includes('advanced') || content.includes('complex'))
      return 'high';
    if (content.includes('simple') || content.includes('basic')) return 'low';
    return 'medium';
  }

  private createCodeGenerator(
    language: string,
    framework?: string
  ): CodeGenerator {
    return {
      generateFromWorkflow: (
        workflow: WorkflowSuggestion,
        _context: CodeContext
      ): CodeGeneratorOutput => {
        const baseCode = this.generateWorkflowCode(
          workflow,
          language,
          framework
        );
        return {
          main: baseCode,
          imports: this.getRequiredImports(language),
          dependencies: this.getRequiredDependencies(language),
          warnings: this.getLanguageWarnings(language),
        };
      },
    };
  }

  private generateWorkflowCode(
    workflow: WorkflowSuggestion,
    language: string,
    framework?: string
  ): string {
    const steps = workflow.steps
      .map((step) => step.codeSnippet || `// ${step.name}`)
      .join('\n\n');

    if (
      framework === 'react' &&
      (language === 'javascript' || language === 'typescript')
    ) {
      return `
import React, { useState, useEffect } from 'react';
import { Endpoint } from '@simplito/privmx-webendpoint';

export const PrivMXApp = () => {
  // Component implementation based on workflow
${steps
  .split('\n')
  .map((line) => (line ? `  ${line}` : ''))
  .join('\n')}
  
  return (
    <div className="privmx-app">
      <h1>${workflow.name}</h1>
      {/* UI implementation */}
    </div>
  );
};
`;
    }

    return `
// ${workflow.name}
// ${workflow.description}

${steps}
`;
  }

  private getRequiredImports(language: string): string[] {
    const imports = ['@simplito/privmx-webendpoint'];

    if (language === 'typescript' || language === 'javascript') {
      imports.push('buffer');
    }

    return imports;
  }

  private getRequiredDependencies(language: string): string[] {
    return this.getRequiredImports(language);
  }

  private getLanguageWarnings(language: string): string[] {
    const warnings: string[] = [];

    if (language === 'javascript') {
      warnings.push('Consider using TypeScript for better type safety');
    }

    return warnings;
  }

  private generateExplanation(workflow: WorkflowSuggestion): string {
    return `This workflow creates a ${workflow.name.toLowerCase()} with ${workflow.steps.length} steps.`;
  }

  private generateNextSteps(workflow: WorkflowSuggestion): string[] {
    return [
      `Test the ${workflow.name}`,
      'Add error handling',
      'Implement UI components',
    ];
  }

  private calculateComplexityScore(result: SearchResult): number {
    const complexity = this.estimateComplexity(result);
    switch (complexity) {
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      default:
        return 1;
    }
  }

  private generateTypedCodeExamples(
    result: SearchResult,
    language?: string
  ): CodeExample[] {
    const examples = this.generateCodeExamples(result, language);
    // Convert CodeExample[] to CodeExample[]
    return examples.map((example) => {
      if (typeof example === 'string') {
        return {
          language: language || 'javascript',
          code: example,
          description: `Example for ${result.title}`,
          difficulty: 'beginner' as const,
        };
      }
      return example as CodeExample;
    });
  }

  /**
   * Combine lexical search (inherited SearchEngine) with vector similarity.
   */
  private async hybridSearch(
    query: string,
    language?: string,
    limit = 20
  ): Promise<SearchResult[]> {
    const lexicalResults = super.search(query, language);

    const semanticRes = await this.apiVectorService.semanticSearch(
      query,
      2 * limit
    );

    const lexicalWeight = Number(process.env.API_TEXT_WEIGHT ?? '0.5');
    const vectorWeight = Number(
      process.env.API_VECTOR_WEIGHT ?? 1 - lexicalWeight
    );

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
        if (lex)
          combined.set(lex.id, { res: lex, score: s.score * vectorWeight });
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .map((c) => c.res)
      .slice(0, limit);
  }
}
