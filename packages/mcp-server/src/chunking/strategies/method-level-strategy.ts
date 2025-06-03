/**
 * Method-Level Chunking Strategy
 * Each API method becomes a separate chunk
 */

import type {
  ParsedContent,
  DocumentChunk,
  ChunkingStrategy,
} from '@privmx/shared';

export class MethodLevelStrategy implements ChunkingStrategy {
  name = 'method-level';

  /**
   * Determine if content should be split
   * Always create individual chunks for methods, classes can stay as single chunks
   */
  shouldSplit(content: ParsedContent): boolean {
    // Methods should always be individual chunks
    if (content.type === 'method') {
      return false; // Don't split methods further, they're already atomic
    }

    // Classes with multiple methods should be split
    if (content.type === 'class' && content.content.includes('## Methods')) {
      return true;
    }

    // Types and examples are usually fine as single chunks
    return false;
  }

  /**
   * Split logic for content that needs to be divided
   */
  splitLogic(content: ParsedContent): DocumentChunk[] {
    if (content.type === 'class') {
      return this.splitClassIntoMethods(content);
    }

    // For other types, create a single chunk
    return [this.createSingleChunk(content)];
  }

  /**
   * Split a class into individual method chunks
   */
  private splitClassIntoMethods(classContent: ParsedContent): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Create a chunk for the class overview (without methods)
    const classOverview = this.createClassOverviewChunk(classContent);
    chunks.push(classOverview);

    // Extract individual methods from the content
    const methods = this.extractMethodsFromClassContent(classContent);

    for (const methodInfo of methods) {
      const methodChunk = this.createMethodChunk(classContent, methodInfo);
      chunks.push(methodChunk);
    }

    return chunks;
  }

  /**
   * Create a class overview chunk without method details
   */
  private createClassOverviewChunk(classContent: ParsedContent): DocumentChunk {
    const { name, description, metadata } = classContent;

    // Build overview content without method details
    let overviewContent = `# ${name} Class\n\n`;
    overviewContent += `${description}\n\n`;

    // Add class-level information
    if (classContent.content.includes('## Overview')) {
      const overviewSection = this.extractSection(
        classContent.content,
        'Overview'
      );
      if (overviewSection) {
        overviewContent += `## Overview\n\n${overviewSection}\n\n`;
      }
    }

    // Add constructor information if available
    if (classContent.content.includes('## Constructor')) {
      const constructorSection = this.extractSection(
        classContent.content,
        'Constructor'
      );
      if (constructorSection) {
        overviewContent += `## Constructor\n\n${constructorSection}\n\n`;
      }
    }

    // Add properties/fields if available
    if (classContent.content.includes('## Properties')) {
      const propertiesSection = this.extractSection(
        classContent.content,
        'Properties'
      );
      if (propertiesSection) {
        overviewContent += `## Properties\n\n${propertiesSection}\n\n`;
      }
    }

    return {
      id: this.generateChunkId(classContent, 'overview'),
      content: overviewContent,
      metadata: {
        ...metadata,
        type: 'class',
        methodName: undefined, // No specific method
        tags: [...metadata.tags, 'overview', 'class-info'],
      },
    };
  }

  /**
   * Extract methods from class content
   */
  private extractMethodsFromClassContent(classContent: ParsedContent): Array<{
    name: string;
    content: string;
    signature: string;
  }> {
    const methods: Array<{
      name: string;
      content: string;
      signature: string;
    }> = [];

    const content = classContent.content;

    // Look for method sections (### methodName or ## methodName)
    const methodPattern = /^(#{2,3})\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\([^)]*\)/gm;
    const matches = Array.from(content.matchAll(methodPattern));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];

      if (match.index === undefined) continue;

      const methodName = match[2];
      const signature = match[0];
      const startIndex = match.index;
      const endIndex = nextMatch?.index ?? content.length;

      const methodContent = content.slice(startIndex, endIndex).trim();

      methods.push({
        name: methodName,
        content: methodContent,
        signature,
      });
    }

    return methods;
  }

  /**
   * Create a chunk for an individual method
   */
  private createMethodChunk(
    classContent: ParsedContent,
    methodInfo: { name: string; content: string; signature: string }
  ): DocumentChunk {
    const className = classContent.name;

    // Build enhanced method content
    let methodContent = `# ${className}.${methodInfo.name}\n\n`;
    methodContent += `\`\`\`typescript\n${methodInfo.signature}\n\`\`\`\n\n`;
    methodContent += methodInfo.content;

    // Add class context
    methodContent += '\n\n## Class Context\n\n';
    methodContent += `This method belongs to the **${className}** class in the **${classContent.metadata.namespace}** namespace.\n\n`;

    // Add related class information
    if (classContent.description) {
      methodContent += `**Class Description**: ${classContent.description}\n\n`;
    }

    return {
      id: this.generateChunkId(classContent, methodInfo.name),
      content: methodContent,
      metadata: {
        ...classContent.metadata,
        type: 'method',
        methodName: methodInfo.name,
        className: className,
        tags: [
          ...classContent.metadata.tags,
          'method',
          methodInfo.name.toLowerCase(),
          className.toLowerCase(),
        ],
        // Add method-specific metadata
        relatedMethods: this.findRelatedMethods(methodInfo.name, className),
        dependencies: this.findMethodDependencies(
          methodInfo.name,
          classContent.metadata.namespace
        ),
        useCases: this.generateMethodUseCases(methodInfo.name),
        commonMistakes: this.generateMethodMistakes(methodInfo.name),
      },
    };
  }

  /**
   * Create a single chunk from content
   */
  private createSingleChunk(content: ParsedContent): DocumentChunk {
    let chunkContent = `# ${content.name}\n\n`;
    chunkContent += `${content.description}\n\n`;
    chunkContent += content.content;

    // Add examples if available
    if (content.examples && content.examples.length > 0) {
      chunkContent += '\n\n## Examples\n\n';
      content.examples.forEach((example, index) => {
        chunkContent += `### Example ${index + 1}${example.title ? `: ${example.title}` : ''}\n\n`;
        chunkContent += `${example.explanation}\n\n`;
        chunkContent += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
      });
    }

    return {
      id: this.generateChunkId(content),
      content: chunkContent,
      metadata: content.metadata,
    };
  }

  /**
   * Extract a specific section from content
   */
  private extractSection(content: string, sectionName: string): string | null {
    const pattern = new RegExp(`^#{2,3}\\s+${sectionName}\\s*$`, 'im');
    const match = content.match(pattern);

    if (!match || match.index === undefined) return null;

    const startIndex = match.index + match[0].length;

    // Find the next section or end of content
    const nextSectionPattern = /^#{2,3}\s+/gm;
    nextSectionPattern.lastIndex = startIndex;
    const nextMatch = nextSectionPattern.exec(content);

    const endIndex = nextMatch?.index ?? content.length;
    return content.slice(startIndex, endIndex).trim();
  }

  /**
   * Generate chunk ID
   */
  private generateChunkId(content: ParsedContent, suffix?: string): string {
    const namespace = content.metadata.namespace || 'general';
    const type = content.metadata.type;
    const name = content.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = Date.now().toString(36);

    const id = `${namespace}-${type}-${name}`;
    return suffix ? `${id}-${suffix}-${timestamp}` : `${id}-${timestamp}`;
  }

  /**
   * Find related methods for a given method
   */
  private findRelatedMethods(methodName: string, className: string): string[] {
    const related: string[] = [];

    // CRUD operation patterns
    if (methodName.includes('create') || methodName === 'create') {
      related.push(
        `${className}.get`,
        `${className}.update`,
        `${className}.delete`,
        `${className}.list`
      );
    } else if (methodName.includes('get') || methodName === 'get') {
      related.push(
        `${className}.create`,
        `${className}.update`,
        `${className}.list`
      );
    } else if (methodName.includes('update') || methodName === 'update') {
      related.push(
        `${className}.get`,
        `${className}.create`,
        `${className}.delete`
      );
    } else if (methodName.includes('delete') || methodName === 'delete') {
      related.push(`${className}.get`, `${className}.list`);
    } else if (methodName.includes('list') || methodName === 'list') {
      related.push(`${className}.get`, `${className}.create`);
    }

    // Send/receive patterns
    if (methodName.includes('send')) {
      related.push(`${className}.receive`, `${className}.list`);
    } else if (methodName.includes('receive')) {
      related.push(`${className}.send`, `${className}.list`);
    }

    // Connect/disconnect patterns
    if (methodName.includes('connect')) {
      related.push(`${className}.disconnect`, `${className}.login`);
    } else if (methodName.includes('disconnect')) {
      related.push(`${className}.connect`);
    }

    return related.filter((method) => method !== `${className}.${methodName}`);
  }

  /**
   * Find dependencies for a method
   */
  private findMethodDependencies(
    methodName: string,
    namespace: string
  ): string[] {
    const dependencies: string[] = [];

    // Common dependencies for most operations
    if (namespace !== 'Core') {
      dependencies.push(
        'Connection.connect',
        'Platform.login',
        'Context.create'
      );
    }

    // Specific method dependencies
    if (methodName.includes('send') || methodName.includes('create')) {
      if (namespace === 'Threads') {
        dependencies.push('Thread.get');
      } else if (namespace === 'Stores') {
        dependencies.push('Store.get');
      } else if (namespace === 'Inboxes') {
        dependencies.push('Inbox.get');
      }
    }

    return dependencies;
  }

  /**
   * Generate use cases for a method
   */
  private generateMethodUseCases(methodName: string): string[] {
    const useCases: string[] = [];

    if (methodName.includes('create')) {
      useCases.push(
        'Setting up new resources',
        'Initial configuration',
        'Resource provisioning'
      );
    } else if (methodName.includes('get')) {
      useCases.push('Data retrieval', 'Status checking', 'Information display');
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
    } else if (methodName.includes('send')) {
      useCases.push('Message delivery', 'Data transmission', 'Communication');
    } else if (methodName.includes('connect')) {
      useCases.push(
        'Establishing connections',
        'Authentication',
        'Session management'
      );
    }

    return useCases;
  }

  /**
   * Generate common mistakes for a method
   */
  private generateMethodMistakes(methodName: string): string[] {
    const mistakes: string[] = [
      'Not checking return values for errors',
      'Missing proper error handling',
      'Not validating input parameters',
    ];

    if (methodName.includes('create')) {
      mistakes.push(
        'Creating duplicate resources',
        'Not checking if resource already exists'
      );
    } else if (methodName.includes('get')) {
      mistakes.push(
        'Not handling missing resources',
        'Assuming resource always exists'
      );
    } else if (methodName.includes('update')) {
      mistakes.push(
        'Not checking if resource exists first',
        'Partial updates without validation'
      );
    } else if (methodName.includes('delete')) {
      mistakes.push(
        'Not checking dependencies before deletion',
        'Missing confirmation for destructive operations'
      );
    } else if (methodName.includes('send')) {
      mistakes.push(
        'Not validating message content',
        'Sending to inactive recipients'
      );
    } else if (methodName.includes('connect')) {
      mistakes.push(
        'Not handling connection timeouts',
        'Missing retry logic for network failures'
      );
    }

    return mistakes;
  }
}
