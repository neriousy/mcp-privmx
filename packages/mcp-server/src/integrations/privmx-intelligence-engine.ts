/**
 * PrivMX Intelligence Engine
 *
 * Our UNIQUE value proposition - deep PrivMX API knowledge, relationships,
 * security patterns, and intelligent workflow suggestions that can't be found elsewhere
 */

import type {
  PrivMXIntelligenceRequest,
  IntegrationResult,
  APIRelationship,
  WorkflowSuggestion,
  PatternValidation,
  OptimizationSuggestion,
} from './types.js';

export class PrivMXIntelligenceEngine {
  private apiRelationships: Map<string, APIRelationship> = new Map();
  private securityPatterns: Map<string, PatternValidation> = new Map();
  private workflowTemplates: Map<string, WorkflowSuggestion[]> = new Map();

  constructor() {
    this.loadPrivMXKnowledge();
  }

  /**
   * Process PrivMX intelligence requests using our unique knowledge
   */
  async processIntelligenceRequest(
    request: PrivMXIntelligenceRequest
  ): Promise<
    IntegrationResult<
      | APIRelationship[]
      | WorkflowSuggestion[]
      | PatternValidation
      | OptimizationSuggestion[]
    >
  > {
    const startTime = Date.now();

    try {
      let result:
        | APIRelationship[]
        | WorkflowSuggestion[]
        | PatternValidation
        | OptimizationSuggestion[];

      switch (request.type) {
        case 'api-relationship':
          result = this.analyzeAPIRelationships(request.query, request.context);
          break;
        case 'workflow-suggestion':
          result = this.generateWorkflowSuggestions(
            request.query,
            request.context
          );
          break;
        case 'pattern-validation':
          result = this.validatePrivMXPatterns(request.query, request.context);
          break;
        case 'optimization':
          result = this.suggestOptimizations(request.query, request.context);
          break;
        default:
          throw new Error(`Unknown intelligence request type: ${request.type}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          toolUsed: 'privmx-intelligence',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Intelligence processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        metadata: {
          toolUsed: 'privmx-intelligence',
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Analyze PrivMX API relationships and dependencies
   */
  private analyzeAPIRelationships(
    query: string,
    context?: { framework?: string; apis?: string[]; codeSnippet?: string }
  ): APIRelationship[] {
    const queryLower = query.toLowerCase();
    const relationships: APIRelationship[] = [];

    // Search for relevant API relationships
    for (const [api, relationship] of this.apiRelationships.entries()) {
      if (
        api.toLowerCase().includes(queryLower) ||
        relationship.api.toLowerCase().includes(queryLower)
      ) {
        relationships.push(relationship);
      }
    }

    // If no direct matches, suggest related APIs based on context
    if (relationships.length === 0 && context?.framework) {
      relationships.push(...this.getFrameworkSpecificAPIs(context.framework));
    }

    return relationships;
  }

  /**
   * Generate intelligent workflow suggestions
   */
  private generateWorkflowSuggestions(
    goal: string,
    context?: {
      framework?: string;
      apis?: string[];
      codeSnippet?: string;
      skillLevel?: string;
    }
  ): WorkflowSuggestion[] {
    const goalLower = goal.toLowerCase();
    let suggestions: WorkflowSuggestion[] = [];

    // Chat/Messaging workflows
    if (goalLower.includes('chat') || goalLower.includes('message')) {
      suggestions = this.workflowTemplates.get('messaging') || [];
    }
    // File sharing workflows
    else if (goalLower.includes('file') || goalLower.includes('share')) {
      suggestions = this.workflowTemplates.get('file-sharing') || [];
    }
    // Inbox/Form workflows
    else if (goalLower.includes('form') || goalLower.includes('inbox')) {
      suggestions = this.workflowTemplates.get('inbox') || [];
    }
    // General PrivMX app
    else {
      suggestions = this.workflowTemplates.get('general') || [];
    }

    // Filter by user skill level if provided
    if (context?.skillLevel) {
      suggestions = suggestions.filter(
        (s) =>
          s.difficulty === context.skillLevel ||
          (context.skillLevel === 'expert' && s.difficulty !== 'beginner')
      );
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Validate PrivMX code patterns and security
   */
  private validatePrivMXPatterns(
    code: string,
    _context?: { framework?: string; apis?: string[]; codeSnippet?: string }
  ): PatternValidation {
    const issues: PatternValidation['issues'] = [];

    // Check for common security issues
    if (code.includes('userPrivateKey') && code.includes('console.log')) {
      issues.push({
        type: 'security',
        message: 'Private key should never be logged or exposed',
        severity: 'error',
        suggestion: 'Remove console.log statements containing private keys',
      });
    }

    // Check for hardcoded credentials
    if (code.includes('pk_') || code.includes('sk_')) {
      issues.push({
        type: 'security',
        message: 'Hardcoded credentials detected',
        severity: 'error',
        suggestion: 'Use environment variables for credentials',
      });
    }

    // Check for proper error handling
    if (
      code.includes('PrivMX.') &&
      !code.includes('try') &&
      !code.includes('catch')
    ) {
      issues.push({
        type: 'best-practice',
        message: 'PrivMX API calls should include error handling',
        severity: 'warning',
        suggestion: 'Wrap PrivMX API calls in try-catch blocks',
      });
    }

    // Check for proper connection management
    if (code.includes('connect(') && !code.includes('disconnect(')) {
      issues.push({
        type: 'best-practice',
        message: 'Missing connection cleanup',
        severity: 'warning',
        suggestion: 'Always disconnect when component unmounts or app closes',
      });
    }

    // Check for deprecated API usage
    const deprecatedAPIs = [
      'Endpoint.connect',
      'ThreadApi.',
      'StoreApi.',
      'InboxApi.',
    ];
    deprecatedAPIs.forEach((deprecated) => {
      if (code.includes(deprecated)) {
        issues.push({
          type: 'best-practice',
          message: `Deprecated API usage: ${deprecated}`,
          severity: 'warning',
          suggestion: 'Update to use the latest PrivMX SDK version',
        });
      }
    });

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /**
   * Suggest PrivMX optimizations
   */
  private suggestOptimizations(
    code: string,
    _context?: { framework?: string; apis?: string[]; codeSnippet?: string }
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Performance optimizations
    if (code.includes('getMessage') && code.includes('for')) {
      suggestions.push({
        type: 'performance',
        description: 'Batch message operations for better performance',
        impact: 'medium',
        implementation: {
          code: `
// Instead of individual calls:
for (const messageId of messageIds) {
  const message = await threadApi.getMessage(messageId);
}

// Use batch operations:
const messages = await threadApi.getMessages(messageIds);
          `.trim(),
          instructions: [
            'Replace individual API calls with batch operations',
            'Implement proper pagination for large datasets',
            'Cache frequently accessed data',
          ],
        },
      });
    }

    // Security optimizations
    if (code.includes('localStorage') && code.includes('privateKey')) {
      suggestions.push({
        type: 'security',
        description: 'Secure key storage implementation',
        impact: 'high',
        implementation: {
          code: `
// Instead of localStorage:
localStorage.setItem('privateKey', key); // INSECURE

// Use secure storage:
await secureStorage.setItem('privateKey', key);
          `.trim(),
          instructions: [
            'Use secure storage for sensitive data',
            'Implement key rotation mechanisms',
            'Add encryption for stored credentials',
          ],
        },
      });
    }

    // API usage optimizations
    if (code.includes('createThread') || code.includes('createStore')) {
      suggestions.push({
        type: 'api-usage',
        description: 'Optimize resource creation patterns',
        impact: 'medium',
        implementation: {
          instructions: [
            'Reuse existing threads/stores when possible',
            'Implement proper cleanup on component unmount',
            'Use connection pooling for multiple operations',
          ],
        },
      });
    }

    return suggestions;
  }

  /**
   * Load our unique PrivMX knowledge base
   */
  private loadPrivMXKnowledge(): void {
    // Thread API relationships
    this.apiRelationships.set('ThreadApi.createThread', {
      api: 'ThreadApi.createThread',
      dependencies: ['Connection.connect'],
      prerequisites: ['User authentication', 'Context ID'],
      commonPatterns: ['Real-time messaging', 'Team collaboration'],
      securityConsiderations: ['End-to-end encryption', 'Access control'],
    });

    this.apiRelationships.set('ThreadApi.sendMessage', {
      api: 'ThreadApi.sendMessage',
      dependencies: ['ThreadApi.createThread'],
      prerequisites: ['Active thread', 'Valid thread ID'],
      commonPatterns: ['Message broadcasting', 'File attachments'],
      securityConsiderations: ['Message encryption', 'Sender verification'],
    });

    // Store API relationships
    this.apiRelationships.set('StoreApi.createStore', {
      api: 'StoreApi.createStore',
      dependencies: ['Connection.connect'],
      prerequisites: ['Context ID', 'User permissions'],
      commonPatterns: ['File storage', 'Document management'],
      securityConsiderations: ['File encryption', 'Access permissions'],
    });

    this.apiRelationships.set('StoreApi.createFile', {
      api: 'StoreApi.createFile',
      dependencies: ['StoreApi.createStore'],
      prerequisites: ['Active store', 'Valid store ID'],
      commonPatterns: ['File upload', 'Version control'],
      securityConsiderations: ['File encryption', 'Upload validation'],
    });

    // Inbox API relationships
    this.apiRelationships.set('InboxApi.createInbox', {
      api: 'InboxApi.createInbox',
      dependencies: ['Connection.connect'],
      prerequisites: ['Context ID', 'Inbox configuration'],
      commonPatterns: ['Form submissions', 'Anonymous feedback'],
      securityConsiderations: ['Anonymous encryption', 'Data validation'],
    });

    // Load workflow suggestions
    this.loadWorkflowSuggestions();

    console.log(`Loaded ${this.apiRelationships.size} API relationships`);
  }

  /**
   * Load intelligent workflow suggestions
   */
  private loadWorkflowSuggestions(): void {
    // Messaging workflows
    this.workflowTemplates.set('messaging', [
      {
        title: 'Basic Secure Chat',
        description: 'Simple encrypted messaging with PrivMX Threads',
        steps: [
          {
            action: 'Setup connection',
            apis: ['Connection.connect'],
            code: `
const connection = await PrivMX.Connection.connect({
  userPrivateKey: process.env.PRIVMX_USER_PRIVATE_KEY,
  solutionId: process.env.PRIVMX_SOLUTION_ID,
  platformUrl: process.env.PRIVMX_PLATFORM_URL
});
            `.trim(),
          },
          {
            action: 'Create thread',
            apis: ['ThreadApi.createThread'],
            code: `
const thread = await connection.thread.createThread({
  contextId: 'chat-context',
  users: ['user1', 'user2'],
  publicMeta: JSON.stringify({ name: 'Chat Room' }),
  privateMeta: JSON.stringify({ description: 'Private chat' })
});
            `.trim(),
          },
          {
            action: 'Send messages',
            apis: ['ThreadApi.sendMessage'],
            code: `
await connection.thread.sendMessage({
  threadId: thread.threadId,
  publicMeta: JSON.stringify({ type: 'text' }),
  privateMeta: JSON.stringify({ timestamp: Date.now() }),
  data: new TextEncoder().encode(messageText)
});
            `.trim(),
          },
        ],
        difficulty: 'beginner',
        estimatedTime: 30,
      },
    ]);

    // File sharing workflows
    this.workflowTemplates.set('file-sharing', [
      {
        title: 'Secure File Storage',
        description: 'Encrypted file storage with PrivMX Stores',
        steps: [
          {
            action: 'Create store',
            apis: ['StoreApi.createStore'],
            code: `
const store = await connection.store.createStore({
  contextId: 'files-context',
  users: ['user1', 'user2'],
  managers: ['user1'],
  publicMeta: JSON.stringify({ name: 'File Storage' }),
  privateMeta: JSON.stringify({ description: 'Secure file sharing' })
});
            `.trim(),
          },
          {
            action: 'Upload file',
            apis: ['StoreApi.createFile'],
            code: `
const fileHandle = await connection.store.createFile({
  storeId: store.storeId,
  publicMeta: JSON.stringify({ name: fileName, type: fileType }),
  privateMeta: JSON.stringify({ uploadedBy: userId, timestamp: Date.now() }),
  size: fileSize
});

await connection.store.writeToFile(fileHandle, fileData);
await connection.store.closeFile(fileHandle);
            `.trim(),
          },
        ],
        difficulty: 'intermediate',
        estimatedTime: 45,
      },
    ]);

    // Inbox workflows
    this.workflowTemplates.set('inbox', [
      {
        title: 'Anonymous Feedback System',
        description: 'Secure anonymous feedback collection',
        steps: [
          {
            action: 'Create inbox',
            apis: ['InboxApi.createInbox'],
            code: `
const inbox = await connection.inbox.createInbox({
  contextId: 'feedback-context',
  users: ['admin'],
  managers: ['admin'],
  publicMeta: JSON.stringify({ name: 'Feedback Inbox', type: 'anonymous' }),
  privateMeta: JSON.stringify({ department: 'Support' })
});
            `.trim(),
          },
          {
            action: 'Send feedback',
            apis: ['InboxApi.sendEntry'],
            code: `
await connection.inbox.sendEntry({
  inboxId: inbox.inboxId,
  publicMeta: JSON.stringify({ type: 'feedback', category: 'bug' }),
  privateMeta: JSON.stringify({ timestamp: Date.now() }),
  data: new TextEncoder().encode(feedbackText)
});
            `.trim(),
          },
        ],
        difficulty: 'beginner',
        estimatedTime: 25,
      },
    ]);
  }

  /**
   * Get framework-specific API recommendations
   */
  private getFrameworkSpecificAPIs(framework: string): APIRelationship[] {
    const frameworkAPIs: Record<string, APIRelationship[]> = {
      react: [
        {
          api: 'React useEffect + PrivMX',
          dependencies: ['React hooks', 'Connection.connect'],
          prerequisites: ['React component', 'State management'],
          commonPatterns: ['Connection management', 'Real-time updates'],
          securityConsiderations: [
            'Component cleanup',
            'Memory leaks prevention',
          ],
        },
      ],
      vue: [
        {
          api: 'Vue composition API + PrivMX',
          dependencies: ['Vue 3 composition', 'Connection.connect'],
          prerequisites: ['Vue setup', 'Reactive state'],
          commonPatterns: ['Reactive connections', 'Lifecycle management'],
          securityConsiderations: ['Component cleanup', 'State security'],
        },
      ],
    };

    return frameworkAPIs[framework] || [];
  }
}
