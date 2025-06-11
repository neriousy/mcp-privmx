/**
 * APIAnalysisService - Analyzes API relationships and patterns
 *
 * Provides analysis of PrivMX API relationships, dependencies, and usage patterns
 * to help AI agents understand how APIs work together.
 */

import type { APINamespace, APIClass, APIMethod } from '../../types/index.js';

interface APIRelationshipGraph {
  prerequisites: Map<string, string[]>;
  dependencies: Map<string, string[]>;
  commonPatterns: Map<string, WorkflowStep[]>;
  errorPatterns: Map<string, ErrorHandler[]>;
  usageFrequency: Map<string, number>;
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  apiMethod: string;
  parameters: Record<string, unknown>;
  prerequisites: string[];
  validation?: string;
  errorHandling?: string;
  codeSnippet?: string;
}

interface ErrorHandler {
  errorType: string;
  description: string;
  solution: string;
  codeExample: string;
}

export class APIAnalysisService {
  private relationshipGraph: APIRelationshipGraph;

  constructor() {
    this.relationshipGraph = {
      prerequisites: new Map(),
      dependencies: new Map(),
      commonPatterns: new Map(),
      errorPatterns: new Map(),
      usageFrequency: new Map(),
    };
  }

  /**
   * Analyze a namespace and build relationship information
   */
  analyzeNamespace(namespace: APINamespace, language: string): void {
    console.log(
      `🔍 Analyzing namespace: ${namespace.name || 'unknown'} (${language})`
    );

    // Skip namespaces that don't have the expected structure
    if (!namespace || typeof namespace !== 'object') {
      console.log(`   ⚠️  Skipping invalid namespace`);
      return;
    }

    // Analyze all classes in the namespace (if they exist and are iterable)
    if (namespace.classes && Array.isArray(namespace.classes)) {
      for (const apiClass of namespace.classes) {
        this.analyzeClass(apiClass, namespace.name, language);
      }
    }

    // Analyze standalone functions (if they exist and are iterable)
    if (namespace.functions && Array.isArray(namespace.functions)) {
      for (const method of namespace.functions) {
        this.analyzeMethod(method, namespace.name, language);
      }
    }
  }

  /**
   * Analyze a single API class
   */
  private analyzeClass(
    apiClass: APIClass,
    namespace: string,
    language: string
  ): void {
    const classKey = `${language}.${namespace}.${apiClass.name}`;

    // Analyze dependencies
    this.relationshipGraph.dependencies.set(
      classKey,
      apiClass.dependencies || []
    );

    // Analyze all methods in the class
    [
      ...apiClass.methods,
      ...apiClass.staticMethods,
      ...apiClass.constructors,
    ].forEach((method) => {
      this.analyzeMethod(method, namespace, language, apiClass.name);
    });
  }

  /**
   * Analyze a single API method
   */
  private analyzeMethod(
    method: APIMethod,
    namespace: string,
    language: string,
    className?: string
  ): void {
    const methodKey = className
      ? `${language}.${namespace}.${className}.${method.name}`
      : `${language}.${namespace}.${method.name}`;

    // Extract and store prerequisites
    const prerequisites = this.extractPrerequisites(method);
    this.relationshipGraph.prerequisites.set(methodKey, prerequisites);

    // Extract usage patterns and convert to workflow steps
    const patterns = this.extractUsagePatterns(method, language);
    this.relationshipGraph.commonPatterns.set(methodKey, patterns);

    // Extract error handling patterns
    const errorPatterns = this.extractErrorPatterns(method);
    this.relationshipGraph.errorPatterns.set(methodKey, errorPatterns);

    // Update usage frequency
    this.updateUsageFrequency(methodKey);

    // Analyze dependencies mentioned in description
    this.extractDependencies(method.description, methodKey);
  }

  /**
   * Extract prerequisites from method information
   */
  private extractPrerequisites(method: APIMethod): string[] {
    const prerequisites: string[] = [];

    // Add existing prerequisites
    prerequisites.push(...(method.prerequisites || []));

    // Infer common prerequisites based on method patterns
    if (
      method.name.includes('create') &&
      !method.className?.includes('Endpoint')
    ) {
      prerequisites.push('connect');
    }

    if (
      method.name.includes('send') ||
      method.name.includes('update') ||
      method.name.includes('delete')
    ) {
      prerequisites.push('create');
    }

    // Connection-dependent methods
    if (
      method.className &&
      ['ThreadApi', 'StoreApi', 'InboxApi'].includes(method.className)
    ) {
      prerequisites.push('Endpoint.connect');
    }

    return [...new Set(prerequisites)]; // Remove duplicates
  }

  /**
   * Extract usage patterns and convert to workflow steps
   */
  private extractUsagePatterns(
    method: APIMethod,
    language: string
  ): WorkflowStep[] {
    const patterns: WorkflowStep[] = [];

    // Common workflow patterns based on method type
    if (method.name.toLowerCase().includes('connect')) {
      patterns.push(this.createConnectWorkflow(language));
    }

    if (
      method.name.toLowerCase().includes('createthread') ||
      method.className === 'ThreadApi'
    ) {
      patterns.push(this.createThreadWorkflow(language));
    }

    if (
      method.name.toLowerCase().includes('sendmessage') ||
      method.name.toLowerCase().includes('message')
    ) {
      patterns.push(this.createMessageWorkflow(language));
    }

    return patterns;
  }

  /**
   * Extract error handling patterns
   */
  private extractErrorPatterns(method: APIMethod): ErrorHandler[] {
    const errorHandlers: ErrorHandler[] = [];

    // Network operations
    if (method.name.includes('connect') || method.name.includes('send')) {
      errorHandlers.push({
        errorType: 'NetworkError',
        description: 'Network connectivity issues',
        solution:
          'Check internet connection and retry with exponential backoff',
        codeExample: this.generateErrorHandlingCode(
          'NetworkError',
          method.name
        ),
      });
    }

    // Authentication errors
    if (method.name.includes('connect') || method.name.includes('auth')) {
      errorHandlers.push({
        errorType: 'AuthenticationError',
        description: 'Invalid credentials or expired session',
        solution: 'Verify credentials and refresh authentication',
        codeExample: this.generateErrorHandlingCode(
          'AuthenticationError',
          method.name
        ),
      });
    }

    // File operation errors
    if (
      method.name.includes('file') ||
      method.name.includes('upload') ||
      method.name.includes('download')
    ) {
      errorHandlers.push({
        errorType: 'FileError',
        description: 'File not found or insufficient permissions',
        solution: 'Check file path and permissions',
        codeExample: this.generateErrorHandlingCode('FileError', method.name),
      });
    }

    return errorHandlers;
  }

  /**
   * Create connection workflow step
   */
  private createConnectWorkflow(language: string): WorkflowStep {
    return {
      id: 'connect-workflow',
      name: 'Establish Connection',
      description: 'Connect to PrivMX Platform',
      apiMethod: 'Endpoint.connect',
      parameters: {
        solutionId: 'string',
        platformUrl: 'string',
        userPrivateKey: 'string',
      },
      prerequisites: [],
      codeSnippet: this.generateConnectionCode(language),
    };
  }

  /**
   * Create thread workflow step
   */
  private createThreadWorkflow(language: string): WorkflowStep {
    return {
      id: 'thread-workflow',
      name: 'Create Thread',
      description: 'Create a new secure thread for messaging',
      apiMethod: 'ThreadApi.createThread',
      parameters: {
        contextId: 'string',
        users: 'string[]',
        managers: 'string[]',
        publicMeta: 'Uint8Array',
        privateMeta: 'Uint8Array',
      },
      prerequisites: ['connect'],
      codeSnippet: this.generateThreadCode(language),
    };
  }

  /**
   * Create message workflow step
   */
  private createMessageWorkflow(language: string): WorkflowStep {
    return {
      id: 'message-workflow',
      name: 'Send Message',
      description: 'Send a message in a thread',
      apiMethod: 'ThreadApi.sendMessage',
      parameters: {
        threadId: 'string',
        publicMeta: 'Uint8Array',
        privateMeta: 'Uint8Array',
        data: 'Uint8Array',
      },
      prerequisites: ['connect', 'createThread'],
      codeSnippet: this.generateMessageCode(language),
    };
  }

  /**
   * Generate connection code example
   */
  private generateConnectionCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
const connection = await PrivMX.Endpoint.connect({
  solutionId: process.env.SOLUTION_ID,
  platformUrl: "https://api.privmx.cloud",
  userPrivateKey: privateKey
});`;
      case 'java':
        return `
Connection connection = Endpoint.connect(
  System.getenv("SOLUTION_ID"),
  "https://api.privmx.cloud",
  privateKey
);`;
      default:
        return 'Connection code example not available for this language';
    }
  }

  /**
   * Generate thread creation code example
   */
  private generateThreadCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
const threadApi = await connection.createThreadApi();
const thread = await threadApi.createThread({
  contextId: "context123",
  users: ["user1", "user2"],
  managers: ["manager1"],
  publicMeta: new Uint8Array(),
  privateMeta: new Uint8Array()
});`;
      case 'java':
        return `
ThreadApi threadApi = connection.createThreadApi();
Thread thread = threadApi.createThread(
  "context123",
  Arrays.asList("user1", "user2"),
  Arrays.asList("manager1"),
  new byte[0],
  new byte[0]
);`;
      default:
        return 'Thread creation code example not available for this language';
    }
  }

  /**
   * Generate message sending code example
   */
  private generateMessageCode(language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return `
await threadApi.sendMessage({
  threadId: thread.threadId,
  publicMeta: Utils.serializeObject({ type: "text" }),
  privateMeta: new Uint8Array(),
  data: Utils.serializeObject({ message: "Hello World!" })
});`;
      case 'java':
        return `
threadApi.sendMessage(
  thread.getThreadId(),
  Utils.serializeObject(Map.of("type", "text")),
  new byte[0],
  Utils.serializeObject(Map.of("message", "Hello World!"))
);`;
      default:
        return 'Message sending code example not available for this language';
    }
  }

  /**
   * Generate error handling code
   */
  private generateErrorHandlingCode(
    errorType: string,
    methodName: string
  ): string {
    return `
try {
  // ${methodName} operation
} catch (error) {
  if (error instanceof ${errorType}) {
    console.error('${errorType} occurred:', error.message);
    // Handle ${errorType} appropriately
  } else {
    throw error; // Re-throw if not handled
  }
}`;
  }

  /**
   * Extract dependencies from description text
   */
  private extractDependencies(description: string, methodKey: string): void {
    if (!description) return;

    const dependencyKeywords = ['requires', 'needs', 'depends on', 'must have'];
    const descLower = description.toLowerCase();

    for (const keyword of dependencyKeywords) {
      if (descLower.includes(keyword)) {
        // Simple extraction - could be enhanced with NLP
        const existing =
          this.relationshipGraph.dependencies.get(methodKey) || [];
        this.relationshipGraph.dependencies.set(methodKey, existing);
      }
    }
  }

  /**
   * Update usage frequency tracking
   */
  private updateUsageFrequency(methodKey: string): void {
    const current = this.relationshipGraph.usageFrequency.get(methodKey) || 0;
    this.relationshipGraph.usageFrequency.set(methodKey, current + 1);
  }

  /**
   * Get the complete relationship graph
   */
  getRelationshipGraph(): APIRelationshipGraph {
    return this.relationshipGraph;
  }

  /**
   * Get prerequisites for a specific method
   */
  getPrerequisites(methodKey: string): string[] {
    return this.relationshipGraph.prerequisites.get(methodKey) || [];
  }

  /**
   * Get common patterns for a specific method
   */
  getCommonPatterns(methodKey: string): WorkflowStep[] {
    return this.relationshipGraph.commonPatterns.get(methodKey) || [];
  }

  /**
   * Get error patterns for a specific method
   */
  getErrorPatterns(methodKey: string): ErrorHandler[] {
    return this.relationshipGraph.errorPatterns.get(methodKey) || [];
  }

  /**
   * Get analysis statistics
   */
  getStats() {
    return {
      totalMethods: this.relationshipGraph.prerequisites.size,
      methodsWithPrerequisites: Array.from(
        this.relationshipGraph.prerequisites.values()
      ).filter((prereqs) => prereqs.length > 0).length,
      commonPatterns: this.relationshipGraph.commonPatterns.size,
      errorPatterns: this.relationshipGraph.errorPatterns.size,
    };
  }
}
