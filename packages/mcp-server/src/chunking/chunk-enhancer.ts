/**
 * Chunk Enhancer
 * Enhances document chunks with additional context and metadata
 */

import type {
  DocumentChunk,
  EmbeddingEnhancer,
  ChunkMetadata,
} from '@privmx/shared';

export interface EnhancementOptions {
  addRelatedMethods: boolean;
  addUsageExamples: boolean;
  addTroubleshooting: boolean;
  addDependencies: boolean;
  enhanceMetadata: boolean;
}

export class ChunkEnhancer implements EmbeddingEnhancer {
  private defaultOptions: EnhancementOptions = {
    addRelatedMethods: true,
    addUsageExamples: true,
    addTroubleshooting: true,
    addDependencies: true,
    enhanceMetadata: true,
  };

  /**
   * Enhance a document chunk with additional context
   */
  async enhance(
    chunk: DocumentChunk,
    options: Partial<EnhancementOptions> = {}
  ): Promise<DocumentChunk> {
    const enhancementOptions = { ...this.defaultOptions, ...options };

    let enhancedContent = chunk.content;
    let enhancedMetadata = { ...chunk.metadata };

    // Add related methods section
    if (enhancementOptions.addRelatedMethods) {
      const relatedMethods = this.findRelatedMethods(chunk);
      if (relatedMethods.length > 0) {
        enhancedContent += this.buildRelatedMethodsSection(relatedMethods);
        enhancedMetadata.relatedMethods = [
          ...(enhancedMetadata.relatedMethods || []),
          ...relatedMethods,
        ];
      }
    }

    // Add usage examples
    if (enhancementOptions.addUsageExamples) {
      const usageExamples = this.generateUsageExamples(chunk);
      if (usageExamples) {
        enhancedContent += usageExamples;
      }
    }

    // Add troubleshooting information
    if (enhancementOptions.addTroubleshooting) {
      const troubleshooting = this.generateTroubleshootingSection(chunk);
      if (troubleshooting) {
        enhancedContent += troubleshooting;
      }
    }

    // Add dependencies information
    if (enhancementOptions.addDependencies) {
      const dependencies = this.findDependencies(chunk);
      if (dependencies.length > 0) {
        enhancedContent += this.buildDependenciesSection(dependencies);
        enhancedMetadata.dependencies = [
          ...(enhancedMetadata.dependencies || []),
          ...dependencies,
        ];
      }
    }

    // Enhance metadata
    if (enhancementOptions.enhanceMetadata) {
      enhancedMetadata = this.enhanceMetadata(enhancedMetadata, chunk);
    }

    return {
      ...chunk,
      content: enhancedContent,
      metadata: enhancedMetadata,
    };
  }

  /**
   * Find related methods for a chunk
   */
  private findRelatedMethods(chunk: DocumentChunk): string[] {
    const relatedMethods: string[] = [];
    const { type, namespace, className, methodName } = chunk.metadata;

    // For methods, find other methods in the same class
    if (type === 'method' && className) {
      // Add common related patterns
      if (methodName?.includes('create')) {
        relatedMethods.push(
          `${className}.get`,
          `${className}.update`,
          `${className}.delete`
        );
      } else if (methodName?.includes('get')) {
        relatedMethods.push(
          `${className}.create`,
          `${className}.list`,
          `${className}.update`
        );
      } else if (methodName?.includes('update')) {
        relatedMethods.push(
          `${className}.get`,
          `${className}.create`,
          `${className}.delete`
        );
      } else if (methodName?.includes('delete')) {
        relatedMethods.push(`${className}.get`, `${className}.list`);
      } else if (methodName?.includes('list')) {
        relatedMethods.push(`${className}.get`, `${className}.create`);
      }
    }

    // For classes, find related classes in the same namespace
    if (type === 'class') {
      switch (namespace) {
        case 'Threads':
          relatedMethods.push(
            'Thread.create',
            'Thread.get',
            'Message.send',
            'Message.list'
          );
          break;
        case 'Stores':
          relatedMethods.push(
            'Store.create',
            'Store.get',
            'File.upload',
            'File.download'
          );
          break;
        case 'Inboxes':
          relatedMethods.push('Inbox.create', 'Inbox.get', 'InboxMessage.send');
          break;
        case 'Core':
          relatedMethods.push(
            'Connection.connect',
            'Platform.login',
            'Context.create'
          );
          break;
      }
    }

    return relatedMethods.filter(
      (method) => method !== `${className}.${methodName}`
    );
  }

  /**
   * Generate usage examples section
   */
  private generateUsageExamples(chunk: DocumentChunk): string {
    const { type, namespace, methodName, className } = chunk.metadata;

    if (type !== 'method' || !methodName || !className) {
      return '';
    }

    const examples = this.getUsagePatterns(namespace, className, methodName);
    if (examples.length === 0) return '';

    let section = '\n\n## Common Usage Patterns\n\n';
    examples.forEach((example, index) => {
      section += `### ${example.title}\n\n`;
      section += `${example.description}\n\n`;
      section += `\`\`\`typescript\n${example.code}\n\`\`\`\n\n`;
    });

    return section;
  }

  /**
   * Get usage patterns for specific methods
   */
  private getUsagePatterns(
    namespace: string,
    className: string,
    methodName: string
  ): Array<{
    title: string;
    description: string;
    code: string;
  }> {
    const patterns: Array<{
      title: string;
      description: string;
      code: string;
    }> = [];

    // Thread-related patterns
    if (namespace === 'Threads' && className === 'Thread') {
      if (methodName === 'create') {
        patterns.push({
          title: 'Creating a Thread with Users',
          description: 'Create a new thread and add users to it.',
          code: `// Create a thread with initial users
const thread = await Thread.create({
  contextId: 'context-id',
  users: ['user1', 'user2'],
  managers: ['manager1'],
  name: 'Project Discussion'
});

console.log('Thread created:', thread.id);`,
        });
      } else if (methodName === 'get') {
        patterns.push({
          title: 'Getting Thread Information',
          description: 'Retrieve thread details and metadata.',
          code: `// Get thread details
const thread = await Thread.get(threadId);
console.log('Thread name:', thread.name);
console.log('Users count:', thread.users.length);`,
        });
      }
    }

    // Store-related patterns
    if (namespace === 'Stores' && className === 'Store') {
      if (methodName === 'create') {
        patterns.push({
          title: 'Creating a Store for File Management',
          description: 'Create a new store for organizing files.',
          code: `// Create a store for project files
const store = await Store.create({
  contextId: 'context-id',
  users: ['user1', 'user2'],
  managers: ['manager1'],
  name: 'Project Files'
});

console.log('Store created:', store.id);`,
        });
      }
    }

    return patterns;
  }

  /**
   * Generate troubleshooting section
   */
  private generateTroubleshootingSection(chunk: DocumentChunk): string {
    const { type, namespace, methodName, className } = chunk.metadata;

    if (type !== 'method' || !methodName || !className) {
      return '';
    }

    const issues = this.getCommonIssues(namespace, className, methodName);
    if (issues.length === 0) return '';

    let section = '\n\n## Common Issues & Solutions\n\n';
    issues.forEach((issue) => {
      section += `### ${issue.problem}\n\n`;
      section += `**Cause**: ${issue.cause}\n\n`;
      section += `**Solution**: ${issue.solution}\n\n`;
      if (issue.example) {
        section += `\`\`\`typescript\n${issue.example}\n\`\`\`\n\n`;
      }
    });

    return section;
  }

  /**
   * Get common issues for specific methods
   */
  private getCommonIssues(
    namespace: string,
    className: string,
    methodName: string
  ): Array<{
    problem: string;
    cause: string;
    solution: string;
    example?: string;
  }> {
    const issues: Array<{
      problem: string;
      cause: string;
      solution: string;
      example?: string;
    }> = [];

    // Connection-related issues
    if (methodName.includes('connect') || methodName.includes('login')) {
      issues.push({
        problem: 'Connection timeout or failure',
        cause: 'Network issues or invalid credentials',
        solution:
          'Check network connectivity and verify credentials. Implement retry logic.',
        example: `try {
  await Connection.connect(endpoint);
} catch (error) {
  if (error.code === 'TIMEOUT') {
    // Retry with exponential backoff
    await retryWithBackoff(() => Connection.connect(endpoint));
  }
}`,
      });
    }

    // Permission-related issues
    if (
      methodName.includes('create') ||
      methodName.includes('update') ||
      methodName.includes('delete')
    ) {
      issues.push({
        problem: 'Permission denied error',
        cause: 'User lacks necessary permissions for the operation',
        solution:
          'Ensure user has proper access rights or is listed as a manager.',
        example: `// Check user permissions before operation
const hasPermission = await Context.checkUserPermission(userId, 'create');
if (!hasPermission) {
  throw new Error('User lacks create permission');
}`,
      });
    }

    return issues;
  }

  /**
   * Find dependencies for a chunk
   */
  private findDependencies(chunk: DocumentChunk): string[] {
    const dependencies: string[] = [];
    const { type, namespace, methodName, className } = chunk.metadata;

    // Method dependencies
    if (type === 'method' && className) {
      // Connection dependencies
      if (methodName?.includes('create') || methodName?.includes('get')) {
        dependencies.push('Connection.connect', 'Platform.login');
      }

      // Context dependencies
      if (namespace !== 'Core' && namespace !== 'Events') {
        dependencies.push('Context.create', 'Context.connect');
      }

      // Thread-specific dependencies
      if (namespace === 'Threads') {
        if (methodName?.includes('Message')) {
          dependencies.push('Thread.get');
        }
      }

      // Store-specific dependencies
      if (namespace === 'Stores') {
        if (methodName?.includes('File')) {
          dependencies.push('Store.get');
        }
      }
    }

    return dependencies;
  }

  /**
   * Build related methods section
   */
  private buildRelatedMethodsSection(relatedMethods: string[]): string {
    let section = '\n\n## Related Methods\n\n';
    relatedMethods.forEach((method) => {
      section += `- \`${method}\`\n`;
    });
    return section + '\n';
  }

  /**
   * Build dependencies section
   */
  private buildDependenciesSection(dependencies: string[]): string {
    let section = '\n\n## Prerequisites\n\n';
    section += 'Before using this method, ensure you have:\n\n';
    dependencies.forEach((dep) => {
      section += `- Called \`${dep}\`\n`;
    });
    return section + '\n';
  }

  /**
   * Enhance chunk metadata
   */
  private enhanceMetadata(
    metadata: ChunkMetadata,
    chunk: DocumentChunk
  ): ChunkMetadata {
    const enhanced = { ...metadata };

    // Add use cases if not present
    if (!enhanced.useCases || enhanced.useCases.length === 0) {
      enhanced.useCases = this.generateUseCases(chunk);
    }

    // Add common mistakes if not present
    if (!enhanced.commonMistakes || enhanced.commonMistakes.length === 0) {
      enhanced.commonMistakes = this.generateCommonMistakes(chunk);
    }

    // Enhance tags
    enhanced.tags = [
      ...new Set([...enhanced.tags, ...this.generateAdditionalTags(chunk)]),
    ];

    return enhanced;
  }

  /**
   * Generate use cases for a chunk
   */
  private generateUseCases(chunk: DocumentChunk): string[] {
    const { type, namespace, methodName } = chunk.metadata;
    const useCases: string[] = [];

    if (type === 'method' && methodName) {
      if (methodName.includes('create')) {
        useCases.push(
          'Setting up new resources',
          'Initial configuration',
          'Resource provisioning'
        );
      } else if (methodName.includes('get')) {
        useCases.push(
          'Data retrieval',
          'Status checking',
          'Information display'
        );
      } else if (methodName.includes('update')) {
        useCases.push(
          'Data modification',
          'Settings change',
          'Resource updating'
        );
      } else if (methodName.includes('delete')) {
        useCases.push(
          'Resource cleanup',
          'Data removal',
          'Resource deprovisioning'
        );
      } else if (methodName.includes('list')) {
        useCases.push(
          'Data browsing',
          'Inventory management',
          'Overview display'
        );
      }
    }

    // Namespace-specific use cases
    switch (namespace) {
      case 'Threads':
        useCases.push(
          'Team communication',
          'Message collaboration',
          'Discussion threads'
        );
        break;
      case 'Stores':
        useCases.push(
          'File management',
          'Document storage',
          'Asset organization'
        );
        break;
      case 'Inboxes':
        useCases.push(
          'Message delivery',
          'Notification system',
          'Communication hub'
        );
        break;
    }

    return useCases;
  }

  /**
   * Generate common mistakes for a chunk
   */
  private generateCommonMistakes(chunk: DocumentChunk): string[] {
    const { type, methodName } = chunk.metadata;
    const mistakes: string[] = [];

    if (type === 'method' && methodName) {
      mistakes.push('Not checking return values for errors');
      mistakes.push('Missing proper error handling');

      if (methodName.includes('create')) {
        mistakes.push('Not validating input parameters');
        mistakes.push('Creating duplicate resources');
      } else if (methodName.includes('get')) {
        mistakes.push('Not handling missing resources');
        mistakes.push('Assuming resource always exists');
      } else if (methodName.includes('update')) {
        mistakes.push('Not checking if resource exists first');
        mistakes.push('Partial updates without validation');
      } else if (methodName.includes('delete')) {
        mistakes.push('Not checking dependencies before deletion');
        mistakes.push('Missing confirmation for destructive operations');
      }
    }

    return mistakes;
  }

  /**
   * Generate additional tags for better searchability
   */
  private generateAdditionalTags(chunk: DocumentChunk): string[] {
    const { type, namespace, methodName, className } = chunk.metadata;
    const tags: string[] = [];

    // Action-based tags
    if (type === 'method' && methodName) {
      if (methodName.includes('create')) tags.push('crud', 'creation', 'new');
      if (methodName.includes('get'))
        tags.push('crud', 'retrieval', 'fetch', 'read');
      if (methodName.includes('update'))
        tags.push('crud', 'modification', 'edit');
      if (methodName.includes('delete'))
        tags.push('crud', 'removal', 'cleanup');
      if (methodName.includes('list'))
        tags.push('crud', 'enumeration', 'browse');
    }

    // Feature-based tags
    switch (namespace) {
      case 'Threads':
        tags.push('messaging', 'communication', 'collaboration');
        break;
      case 'Stores':
        tags.push('files', 'storage', 'documents');
        break;
      case 'Inboxes':
        tags.push('inbox', 'notifications', 'delivery');
        break;
      case 'Core':
        tags.push('connection', 'platform', 'authentication');
        break;
      case 'Crypto':
        tags.push('encryption', 'security', 'crypto');
        break;
    }

    return tags;
  }
}
