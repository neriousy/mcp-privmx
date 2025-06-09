/**
 * API Relationship Analyzer
 *
 * Analyzes PrivMX API documentation to build intelligent relationship graphs.
 * Extracts dependencies, prerequisites, common patterns, and error scenarios.
 */

import { APIMethod, APIClass, APINamespace } from '../api/types.js';
import { APIRelationshipGraph, WorkflowStep, ErrorHandler } from './types.js';

export class APIRelationshipAnalyzer {
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
   * Analyze API namespace and build relationship graph
   */
  analyzeNamespace(namespace: APINamespace, language: string): void {
    console.log(
      `🔍 Analyzing relationships for ${namespace.name} (${language})`
    );

    // Analyze class relationships
    for (const apiClass of namespace.classes) {
      this.analyzeClass(apiClass, namespace.name, language);
    }

    // Analyze standalone functions
    for (const method of namespace.functions) {
      this.analyzeMethod(method, namespace.name, language);
    }
  }

  /**
   * Analyze class and its methods
   */
  private analyzeClass(
    apiClass: APIClass,
    namespace: string,
    language: string
  ): void {
    const classKey = `${language}:${namespace}:${apiClass.name}`;

    // Extract dependencies from class documentation
    this.extractDependencies(apiClass.description || '', classKey);

    // Analyze constructors
    for (const constructor of apiClass.constructors) {
      this.analyzeMethod(constructor, namespace, language, apiClass.name);
    }

    // Analyze methods
    for (const method of apiClass.methods) {
      this.analyzeMethod(method, namespace, language, apiClass.name);
    }

    // Analyze static methods
    for (const method of apiClass.staticMethods) {
      this.analyzeMethod(method, namespace, language, apiClass.name);
    }
  }

  /**
   * Analyze individual method for patterns and dependencies
   */
  private analyzeMethod(
    method: APIMethod,
    namespace: string,
    language: string,
    className?: string
  ): void {
    const methodKey = `${language}:${namespace}:${className || ''}:${method.name}`;

    // Extract prerequisites from method description and parameters
    const prerequisites = this.extractPrerequisites(method);
    if (prerequisites.length > 0) {
      this.relationshipGraph.prerequisites.set(methodKey, prerequisites);
    }

    // Extract common usage patterns
    const patterns = this.extractUsagePatterns(method, language);
    if (patterns.length > 0) {
      this.relationshipGraph.commonPatterns.set(methodKey, patterns);
    }

    // Extract error patterns
    const errorPatterns = this.extractErrorPatterns(method);
    if (errorPatterns.length > 0) {
      this.relationshipGraph.errorPatterns.set(methodKey, errorPatterns);
    }

    // Track method usage frequency (for future ML)
    this.updateUsageFrequency(methodKey);
  }

  /**
   * Extract prerequisites from method analysis
   */
  private extractPrerequisites(method: APIMethod): string[] {
    const prerequisites: string[] = [];
    const description = method.description?.toLowerCase() || '';

    // Common PrivMX setup patterns
    if (description.includes('connection') || description.includes('connect')) {
      prerequisites.push('Endpoint.setup()');
      prerequisites.push('Endpoint.connect()');
    }

    if (description.includes('thread') && method.name !== 'createThread') {
      prerequisites.push('createThread()');
    }

    if (description.includes('message') && !method.name.includes('create')) {
      prerequisites.push('createThread()');
    }

    if (description.includes('store') && method.name !== 'createStore') {
      prerequisites.push('createStore()');
    }

    if (description.includes('inbox') && method.name !== 'createInbox') {
      prerequisites.push('createInbox()');
    }

    // Event handling prerequisites
    if (description.includes('event') || method.name.includes('Event')) {
      prerequisites.push('getEventQueue()');
    }

    return prerequisites;
  }

  /**
   * Extract common usage patterns
   */
  private extractUsagePatterns(
    method: APIMethod,
    language: string
  ): WorkflowStep[] {
    const patterns: WorkflowStep[] = [];

    // Generate workflow steps based on method type
    if (method.name === 'connect') {
      patterns.push(this.createConnectWorkflow(language));
    }

    if (method.name === 'createThread') {
      patterns.push(this.createThreadWorkflow(language));
    }

    if (method.name === 'sendMessage') {
      patterns.push(this.createMessageWorkflow(language));
    }

    return patterns;
  }

  /**
   * Extract error patterns from method documentation
   */
  private extractErrorPatterns(method: APIMethod): ErrorHandler[] {
    const errorPatterns: ErrorHandler[] = [];
    const description = method.description || '';

    // Common PrivMX error patterns
    if (method.name.includes('connect') || method.name.includes('Connect')) {
      errorPatterns.push({
        errorType: 'CONNECTION_FAILED',
        description: 'Failed to establish connection to PrivMX Bridge',
        solution: 'Check bridge URL, solution ID, and private key',
        codeExample: this.generateErrorHandlingCode('connection', method.name),
      });
    }

    if (method.name.includes('create')) {
      errorPatterns.push({
        errorType: 'CREATION_FAILED',
        description: 'Failed to create resource',
        solution: 'Verify user permissions and required parameters',
        codeExample: this.generateErrorHandlingCode('creation', method.name),
      });
    }

    return errorPatterns;
  }

  /**
   * Generate workflow steps for connection setup
   */
  private createConnectWorkflow(language: string): WorkflowStep {
    return {
      id: `connect-workflow-${language}`,
      name: 'Establish PrivMX Connection',
      description: 'Set up connection to PrivMX Bridge',
      apiMethod: 'Endpoint.connect',
      parameters: {
        userPrivKey: 'string',
        solutionId: 'string',
        bridgeUrl: 'string',
      },
      prerequisites: ['Endpoint.setup()'],
      validation: 'Check connection status',
      errorHandling: 'Handle connection errors',
      codeSnippet: this.generateConnectionCode(language),
    };
  }

  /**
   * Generate workflow steps for thread creation
   */
  private createThreadWorkflow(language: string): WorkflowStep {
    return {
      id: `create-thread-workflow-${language}`,
      name: 'Create Secure Thread',
      description: 'Create a new thread for secure messaging',
      apiMethod: 'ThreadApi.createThread',
      parameters: {
        contextId: 'string',
        users: 'UserWithPubKey[]',
        managers: 'UserWithPubKey[]',
        publicMeta: 'Buffer',
        privateMeta: 'Buffer',
      },
      prerequisites: ['Endpoint.connect()', 'createThreadApi()'],
      codeSnippet: this.generateThreadCode(language),
    };
  }

  /**
   * Generate workflow steps for message sending
   */
  private createMessageWorkflow(language: string): WorkflowStep {
    return {
      id: `send-message-workflow-${language}`,
      name: 'Send Secure Message',
      description: 'Send an encrypted message to a thread',
      apiMethod: 'ThreadApi.sendMessage',
      parameters: {
        threadId: 'string',
        publicMeta: 'Buffer',
        privateMeta: 'Buffer',
        data: 'Buffer',
      },
      prerequisites: ['createThread()', 'ThreadApi instance'],
      codeSnippet: this.generateMessageCode(language),
    };
  }

  /**
   * Generate connection code for different languages
   */
  private generateConnectionCode(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return `
// Initialize PrivMX Endpoint
await Endpoint.setup("/public");
const connection = await Endpoint.connect(
  userPrivKey,
  solutionId,
  bridgeUrl
);
`;
      case 'java':
        return `
// Initialize PrivMX Endpoint
Endpoint.setup("/public");
Connection connection = Endpoint.connect(
  userPrivKey,
  solutionId,
  bridgeUrl
);
`;
      default:
        return `// Connection setup for ${language}`;
    }
  }

  /**
   * Generate thread creation code
   */
  private generateThreadCode(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return `
const threadApi = await Endpoint.createThreadApi(connection);
const threadId = await threadApi.createThread(
  contextId,
  users,
  managers,
  Buffer.from("public metadata"),
  Buffer.from(JSON.stringify({ name: "Thread Name" }))
);
`;
      case 'java':
        return `
ThreadApi threadApi = Endpoint.createThreadApi(connection);
String threadId = threadApi.createThread(
  contextId,
  users,
  managers,
  "public metadata".getBytes(),
  "{\"name\": \"Thread Name\"}".getBytes()
);
`;
      default:
        return `// Thread creation for ${language}`;
    }
  }

  /**
   * Generate message sending code
   */
  private generateMessageCode(language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return `
await threadApi.sendMessage(
  threadId,
  Buffer.from("message type"),
  Buffer.from(JSON.stringify({ timestamp: Date.now() })),
  Buffer.from(messageContent)
);
`;
      case 'java':
        return `
threadApi.sendMessage(
  threadId,
  "message type".getBytes(),
  ("{\"timestamp\": " + System.currentTimeMillis() + "}").getBytes(),
  messageContent.getBytes()
);
`;
      default:
        return `// Message sending for ${language}`;
    }
  }

  /**
   * Generate error handling code examples
   */
  private generateErrorHandlingCode(
    errorType: string,
    methodName: string
  ): string {
    return `
try {
  // ${methodName} call here
} catch (error) {
  console.error('${errorType} error:', error);
  // Handle specific error cases
  if (error.code === 'CONNECTION_FAILED') {
    // Retry connection or show user-friendly message
  }
}
`;
  }

  /**
   * Extract dependencies from text description
   */
  private extractDependencies(description: string, key: string): void {
    const dependencies: string[] = [];
    const lowerDesc = description.toLowerCase();

    // Common PrivMX dependencies
    if (lowerDesc.includes('endpoint')) {
      dependencies.push('@simplito/privmx-webendpoint');
    }

    if (lowerDesc.includes('buffer') || lowerDesc.includes('uint8array')) {
      dependencies.push('buffer');
    }

    if (dependencies.length > 0) {
      this.relationshipGraph.dependencies.set(key, dependencies);
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
   * Get the built relationship graph
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
   * Get common patterns for a method
   */
  getCommonPatterns(methodKey: string): WorkflowStep[] {
    return this.relationshipGraph.commonPatterns.get(methodKey) || [];
  }

  /**
   * Get error patterns for a method
   */
  getErrorPatterns(methodKey: string): ErrorHandler[] {
    return this.relationshipGraph.errorPatterns.get(methodKey) || [];
  }

  /**
   * Get statistics about the relationship graph
   */
  getStats(): {
    totalMethods: number;
    methodsWithPrerequisites: number;
    commonPatterns: number;
    errorPatterns: number;
  } {
    return {
      totalMethods: this.relationshipGraph.usageFrequency.size,
      methodsWithPrerequisites: this.relationshipGraph.prerequisites.size,
      commonPatterns: this.relationshipGraph.commonPatterns.size,
      errorPatterns: this.relationshipGraph.errorPatterns.size,
    };
  }
}
