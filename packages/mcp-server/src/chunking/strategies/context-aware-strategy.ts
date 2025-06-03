/**
 * Context-Aware Chunking Strategy
 * Groups related content together while maintaining semantic relationships
 */

import type {
  ParsedContent,
  DocumentChunk,
  ChunkingStrategy,
} from '@privmx/shared';

export class ContextAwareStrategy implements ChunkingStrategy {
  name = 'context-aware';

  /**
   * Determine if content should be split based on context and relationships
   */
  shouldSplit(content: ParsedContent): boolean {
    // Large content should be split while preserving context
    if (content.content.length > 2000) {
      return true;
    }

    // Classes with many methods should be split into logical groups
    if (content.type === 'class') {
      const methodCount = this.countMethods(content.content);
      if (methodCount > 5) {
        return true;
      }
    }

    // Long tutorials should be split into logical sections
    if (content.type === 'example' && content.content.includes('##')) {
      const sectionCount = this.countSections(content.content);
      if (sectionCount > 3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Split logic that preserves context and relationships
   */
  splitLogic(content: ParsedContent): DocumentChunk[] {
    if (content.type === 'class') {
      return this.splitClassByFunctionality(content);
    }

    if (content.type === 'example') {
      return this.splitTutorialBySections(content);
    }

    // For other types, split by content length while preserving context
    return this.splitByContextualBoundaries(content);
  }

  /**
   * Split class by functional groups (CRUD, messaging, etc.)
   */
  private splitClassByFunctionality(
    classContent: ParsedContent
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const methods = this.extractMethods(classContent.content);

    // Group methods by functionality
    const methodGroups = this.groupMethodsByFunctionality(methods);

    // Create class overview chunk
    const overviewChunk = this.createClassOverviewChunk(classContent);
    chunks.push(overviewChunk);

    // Create chunks for each functional group
    for (const [groupName, groupMethods] of Object.entries(methodGroups)) {
      if (groupMethods.length > 0) {
        const groupChunk = this.createFunctionalGroupChunk(
          classContent,
          groupName,
          groupMethods
        );
        chunks.push(groupChunk);
      }
    }

    return chunks;
  }

  /**
   * Split tutorial content by logical sections
   */
  private splitTutorialBySections(
    tutorialContent: ParsedContent
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sections = this.extractSections(tutorialContent.content);

    // Create introduction chunk if exists
    const introduction = this.extractIntroduction(tutorialContent);
    if (introduction) {
      chunks.push(introduction);
    }

    // Create chunks for each section, potentially grouping related ones
    const sectionGroups = this.groupRelatedSections(sections);

    for (const group of sectionGroups) {
      const sectionChunk = this.createSectionGroupChunk(tutorialContent, group);
      chunks.push(sectionChunk);
    }

    return chunks;
  }

  /**
   * Split content by contextual boundaries
   */
  private splitByContextualBoundaries(content: ParsedContent): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const maxChunkSize = 1500;
    const overlapSize = 200;

    // Split by logical boundaries (headers, paragraphs)
    const boundaries = this.findContextualBoundaries(content.content);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const boundary of boundaries) {
      const potentialChunk =
        currentChunk + (currentChunk ? '\n\n' : '') + boundary.content;

      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Create chunk with current content
        if (currentChunk) {
          const chunk = this.createContextualChunk(
            content,
            currentChunk,
            chunkIndex++,
            boundary.context
          );
          chunks.push(chunk);
        }

        // Start new chunk with overlap
        const overlap = this.extractContextualOverlap(
          currentChunk,
          overlapSize
        );
        currentChunk = overlap + boundary.content;
      }
    }

    // Add final chunk
    if (currentChunk) {
      const chunk = this.createContextualChunk(
        content,
        currentChunk,
        chunkIndex
      );
      chunks.push(chunk);
    }

    return chunks.length > 0 ? chunks : [this.createSingleChunk(content)];
  }

  /**
   * Count methods in content
   */
  private countMethods(content: string): number {
    const methodPattern = /^(#{2,3})\s+([a-zA-Z][a-zA-Z0-9_]*)\s*\([^)]*\)/gm;
    const matches = content.match(methodPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Count sections in content
   */
  private countSections(content: string): number {
    const sectionPattern = /^#{1,3}\s+.+$/gm;
    const matches = content.match(sectionPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Extract methods with their content
   */
  private extractMethods(content: string): Array<{
    name: string;
    content: string;
    signature: string;
    category: string;
  }> {
    const methods: Array<{
      name: string;
      content: string;
      signature: string;
      category: string;
    }> = [];

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
      const category = this.categorizeMethod(methodName);

      methods.push({
        name: methodName,
        content: methodContent,
        signature,
        category,
      });
    }

    return methods;
  }

  /**
   * Group methods by functionality
   */
  private groupMethodsByFunctionality(
    methods: Array<{
      name: string;
      content: string;
      signature: string;
      category: string;
    }>
  ): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'CRUD Operations': [],
      Communication: [],
      Authentication: [],
      Configuration: [],
      Utilities: [],
    };

    for (const method of methods) {
      switch (method.category) {
        case 'crud':
          groups['CRUD Operations'].push(method);
          break;
        case 'communication':
          groups['Communication'].push(method);
          break;
        case 'auth':
          groups['Authentication'].push(method);
          break;
        case 'config':
          groups['Configuration'].push(method);
          break;
        default:
          groups['Utilities'].push(method);
      }
    }

    return groups;
  }

  /**
   * Categorize method by name and functionality
   */
  private categorizeMethod(methodName: string): string {
    const name = methodName.toLowerCase();

    // CRUD operations
    if (
      name.includes('create') ||
      name.includes('get') ||
      name.includes('update') ||
      name.includes('delete') ||
      name.includes('list') ||
      name.includes('find')
    ) {
      return 'crud';
    }

    // Communication
    if (
      name.includes('send') ||
      name.includes('receive') ||
      name.includes('message') ||
      name.includes('notify')
    ) {
      return 'communication';
    }

    // Authentication
    if (
      name.includes('login') ||
      name.includes('auth') ||
      name.includes('connect') ||
      name.includes('disconnect')
    ) {
      return 'auth';
    }

    // Configuration
    if (
      name.includes('config') ||
      name.includes('setting') ||
      name.includes('setup') ||
      name.includes('init')
    ) {
      return 'config';
    }

    return 'utility';
  }

  /**
   * Create class overview chunk
   */
  private createClassOverviewChunk(classContent: ParsedContent): DocumentChunk {
    const { name, description, metadata } = classContent;

    let overviewContent = `# ${name} Class Overview\n\n`;
    overviewContent += `${description}\n\n`;

    // Add namespace and importance info
    overviewContent += `**Namespace**: ${metadata.namespace}\n`;
    overviewContent += `**Importance**: ${metadata.importance}\n\n`;

    // Extract and add class-level sections
    const classSections = ['Overview', 'Constructor', 'Properties', 'Events'];
    for (const sectionName of classSections) {
      const section = this.extractSectionContent(
        classContent.content,
        sectionName
      );
      if (section) {
        overviewContent += `## ${sectionName}\n\n${section}\n\n`;
      }
    }

    return {
      id: this.generateChunkId(classContent, 'overview'),
      content: overviewContent,
      metadata: {
        ...metadata,
        type: 'class',
        tags: [...metadata.tags, 'overview', 'class-structure'],
      },
    };
  }

  /**
   * Create functional group chunk
   */
  private createFunctionalGroupChunk(
    classContent: ParsedContent,
    groupName: string,
    methods: Array<{
      name: string;
      content: string;
      signature: string;
      category: string;
    }>
  ): DocumentChunk {
    const className = classContent.name;

    let groupContent = `# ${className} - ${groupName}\n\n`;
    groupContent += `This section covers ${groupName.toLowerCase()} methods for the **${className}** class.\n\n`;

    // Add group description based on functionality
    groupContent += this.getGroupDescription(groupName);

    // Add each method in the group
    for (const method of methods) {
      groupContent += `${method.content}\n\n---\n\n`;
    }

    // Add related information
    groupContent += this.getGroupRelatedInfo(groupName, className);

    return {
      id: this.generateChunkId(
        classContent,
        groupName.toLowerCase().replace(/\s+/g, '-')
      ),
      content: groupContent,
      metadata: {
        ...classContent.metadata,
        type: 'method',
        className: className,
        tags: [
          ...classContent.metadata.tags,
          'functional-group',
          groupName.toLowerCase().replace(/\s+/g, '-'),
          ...methods.map((m) => m.name.toLowerCase()),
        ],
        relatedMethods: methods.map((m) => `${className}.${m.name}`),
        useCases: this.getGroupUseCases(groupName),
      },
    };
  }

  /**
   * Get description for functional group
   */
  private getGroupDescription(groupName: string): string {
    switch (groupName) {
      case 'CRUD Operations':
        return `These methods handle basic data operations: creating, reading, updating, and deleting resources.\n\n`;
      case 'Communication':
        return `These methods handle message sending, receiving, and communication between users.\n\n`;
      case 'Authentication':
        return `These methods handle user authentication, connections, and session management.\n\n`;
      case 'Configuration':
        return `These methods handle configuration, setup, and initialization tasks.\n\n`;
      default:
        return `These utility methods provide additional functionality and support operations.\n\n`;
    }
  }

  /**
   * Get related information for functional group
   */
  private getGroupRelatedInfo(groupName: string, className: string): string {
    let info = `## Related Information\n\n`;

    switch (groupName) {
      case 'CRUD Operations':
        info += `- Always check permissions before performing operations\n`;
        info += `- Handle errors appropriately for each operation\n`;
        info += `- Consider pagination for list operations\n`;
        break;
      case 'Communication':
        info += `- Validate message content before sending\n`;
        info += `- Handle offline recipients gracefully\n`;
        info += `- Implement proper error handling for network issues\n`;
        break;
      case 'Authentication':
        info += `- Always validate credentials securely\n`;
        info += `- Implement proper session management\n`;
        info += `- Handle connection timeouts appropriately\n`;
        break;
    }

    return info;
  }

  /**
   * Get use cases for functional group
   */
  private getGroupUseCases(groupName: string): string[] {
    switch (groupName) {
      case 'CRUD Operations':
        return [
          'Data management',
          'Resource administration',
          'Content manipulation',
        ];
      case 'Communication':
        return ['Real-time messaging', 'Notifications', 'Team collaboration'];
      case 'Authentication':
        return ['User login', 'Session management', 'Security validation'];
      case 'Configuration':
        return ['System setup', 'Settings management', 'Initialization'];
      default:
        return ['General utilities', 'Helper operations', 'Support functions'];
    }
  }

  /**
   * Extract sections from tutorial content
   */
  private extractSections(content: string): Array<{
    title: string;
    content: string;
    level: number;
  }> {
    const sections: Array<{
      title: string;
      content: string;
      level: number;
    }> = [];

    const sectionPattern = /^(#{1,3})\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(sectionPattern));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];

      if (match.index === undefined) continue;

      const level = match[1].length;
      const title = match[2];
      const startIndex = match.index;
      const endIndex = nextMatch?.index ?? content.length;

      const sectionContent = content.slice(startIndex, endIndex).trim();

      sections.push({
        title,
        content: sectionContent,
        level,
      });
    }

    return sections;
  }

  /**
   * Group related sections together
   */
  private groupRelatedSections(
    sections: Array<{
      title: string;
      content: string;
      level: number;
    }>
  ): Array<
    Array<{
      title: string;
      content: string;
      level: number;
    }>
  > {
    const groups: Array<
      Array<{
        title: string;
        content: string;
        level: number;
      }>
    > = [];

    let currentGroup: Array<{
      title: string;
      content: string;
      level: number;
    }> = [];

    for (const section of sections) {
      // Start new group for major sections (h1, h2)
      if (section.level <= 2 && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [section];
      } else {
        currentGroup.push(section);
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Extract introduction from tutorial
   */
  private extractIntroduction(
    tutorialContent: ParsedContent
  ): DocumentChunk | null {
    const content = tutorialContent.content;
    const firstHeaderMatch = content.match(/^#{1,3}\s+/m);

    if (!firstHeaderMatch || firstHeaderMatch.index === undefined) {
      return null;
    }

    const introduction = content.slice(0, firstHeaderMatch.index).trim();
    if (introduction.length < 50) {
      return null;
    }

    let introContent = `# ${tutorialContent.name} - Introduction\n\n`;
    introContent += `${tutorialContent.description}\n\n`;
    introContent += introduction;

    return {
      id: this.generateChunkId(tutorialContent, 'introduction'),
      content: introContent,
      metadata: {
        ...tutorialContent.metadata,
        tags: [
          ...tutorialContent.metadata.tags,
          'introduction',
          'getting-started',
        ],
      },
    };
  }

  /**
   * Create section group chunk
   */
  private createSectionGroupChunk(
    tutorialContent: ParsedContent,
    sectionGroup: Array<{
      title: string;
      content: string;
      level: number;
    }>
  ): DocumentChunk {
    const mainSection = sectionGroup[0];
    const groupTitle = mainSection.title;

    let groupContent = `# ${tutorialContent.name} - ${groupTitle}\n\n`;

    // Add all sections in the group
    for (const section of sectionGroup) {
      groupContent += `${section.content}\n\n`;
      if (section !== sectionGroup[sectionGroup.length - 1]) {
        groupContent += `---\n\n`;
      }
    }

    return {
      id: this.generateChunkId(
        tutorialContent,
        groupTitle.toLowerCase().replace(/\s+/g, '-')
      ),
      content: groupContent,
      metadata: {
        ...tutorialContent.metadata,
        tags: [
          ...tutorialContent.metadata.tags,
          'tutorial-section',
          groupTitle.toLowerCase().replace(/\s+/g, '-'),
        ],
      },
    };
  }

  /**
   * Find contextual boundaries for splitting
   */
  private findContextualBoundaries(content: string): Array<{
    content: string;
    context: string;
  }> {
    const boundaries: Array<{
      content: string;
      context: string;
    }> = [];

    // Split by headers first
    const headerPattern = /^#{1,6}\s+.+$/gm;
    const matches = Array.from(content.matchAll(headerPattern));

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const nextMatch = matches[i + 1];

        if (match.index === undefined) continue;

        const startIndex = match.index;
        const endIndex = nextMatch?.index ?? content.length;
        const sectionContent = content.slice(startIndex, endIndex).trim();
        const context = match[0]; // The header itself

        boundaries.push({
          content: sectionContent,
          context,
        });
      }
    } else {
      // Fall back to paragraph splitting
      const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
      for (const paragraph of paragraphs) {
        boundaries.push({
          content: paragraph,
          context: 'paragraph',
        });
      }
    }

    return boundaries;
  }

  /**
   * Extract contextual overlap
   */
  private extractContextualOverlap(
    content: string,
    overlapSize: number
  ): string {
    if (content.length <= overlapSize) return content;

    const overlap = content.slice(-overlapSize);

    // Try to end at a sentence boundary
    const sentenceEnd = overlap.lastIndexOf('. ');
    if (sentenceEnd > overlapSize / 2) {
      return overlap.slice(sentenceEnd + 2);
    }

    // Try to end at a paragraph boundary
    const paragraphEnd = overlap.lastIndexOf('\n');
    if (paragraphEnd > overlapSize / 2) {
      return overlap.slice(paragraphEnd + 1);
    }

    return overlap;
  }

  /**
   * Create contextual chunk
   */
  private createContextualChunk(
    content: ParsedContent,
    chunkContent: string,
    index: number,
    context?: string
  ): DocumentChunk {
    let enhancedContent = chunkContent;

    // Add context information if available
    if (context && context !== 'paragraph') {
      enhancedContent =
        `# ${content.name} - Part ${index + 1}\n\n` + enhancedContent;
    }

    return {
      id: this.generateChunkId(content, `part-${index}`),
      content: enhancedContent,
      metadata: {
        ...content.metadata,
        tags: [...content.metadata.tags, 'contextual-chunk', `part-${index}`],
      },
    };
  }

  /**
   * Create single chunk
   */
  private createSingleChunk(content: ParsedContent): DocumentChunk {
    let chunkContent = `# ${content.name}\n\n`;
    chunkContent += `${content.description}\n\n`;
    chunkContent += content.content;

    return {
      id: this.generateChunkId(content),
      content: chunkContent,
      metadata: content.metadata,
    };
  }

  /**
   * Extract section content by name
   */
  private extractSectionContent(
    content: string,
    sectionName: string
  ): string | null {
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
}
