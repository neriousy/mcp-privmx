/**
 * Hierarchical Chunking Strategy
 * Maintains parent-child relationships and document hierarchy
 */

import type {
  ParsedContent,
  DocumentChunk,
  ChunkingStrategy,
} from '@privmx/shared';

export class HierarchicalStrategy implements ChunkingStrategy {
  name = 'hierarchical';

  /**
   * Determine if content should be split hierarchically
   */
  shouldSplit(content: ParsedContent): boolean {
    // Split based on hierarchical structure
    const hasHierarchy =
      content.content.includes('##') || content.content.includes('###');
    const isLarge = content.content.length > 1000;

    return hasHierarchy || isLarge;
  }

  /**
   * Split logic that maintains hierarchy
   */
  splitLogic(content: ParsedContent): DocumentChunk[] {
    const hierarchy = this.buildHierarchy(content);
    return this.createHierarchicalChunks(content, hierarchy);
  }

  /**
   * Build content hierarchy
   */
  private buildHierarchy(content: ParsedContent): Array<{
    level: number;
    title: string;
    content: string;
    children: any[];
    parent?: any;
  }> {
    const lines = content.content.split('\n');
    const hierarchy: Array<{
      level: number;
      title: string;
      content: string;
      children: any[];
      parent?: any;
    }> = [];
    const stack: any[] = [];

    let currentSection = {
      level: 0,
      title: content.name,
      content: '',
      children: [],
    };

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2];

        // Find parent in stack
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parent = stack.length > 0 ? stack[stack.length - 1] : null;

        const section = {
          level,
          title,
          content: '',
          children: [],
          parent,
        };

        if (parent) {
          parent.children.push(section);
        } else {
          hierarchy.push(section);
        }

        stack.push(section);
        currentSection = section;
      } else {
        currentSection.content += line + '\n';
      }
    }

    return hierarchy;
  }

  /**
   * Create hierarchical chunks
   */
  private createHierarchicalChunks(
    content: ParsedContent,
    hierarchy: Array<{
      level: number;
      title: string;
      content: string;
      children: any[];
      parent?: any;
    }>
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Create root chunk
    const rootChunk = this.createRootChunk(content);
    chunks.push(rootChunk);

    // Create chunks for each section in hierarchy
    for (const section of hierarchy) {
      const sectionChunks = this.createSectionChunks(content, section);
      chunks.push(...sectionChunks);
    }

    return chunks;
  }

  /**
   * Create root chunk
   */
  private createRootChunk(content: ParsedContent): DocumentChunk {
    let rootContent = `# ${content.name}\n\n`;
    rootContent += `${content.description}\n\n`;

    // Add overview or introduction
    const firstSection = content.content.split(/^#{1,6}\s+/m)[0];
    if (firstSection.trim()) {
      rootContent += firstSection.trim();
    }

    return {
      id: this.generateChunkId(content, 'root'),
      content: rootContent,
      metadata: {
        ...content.metadata,
        tags: [...content.metadata.tags, 'root', 'hierarchy-root'],
      },
    };
  }

  /**
   * Create chunks for a section and its children
   */
  private createSectionChunks(
    content: ParsedContent,
    section: any
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Create chunk for this section
    const sectionChunk = this.createSectionChunk(content, section);
    chunks.push(sectionChunk);

    // Create chunks for children if they're substantial
    for (const child of section.children) {
      if (child.content.length > 100 || child.children.length > 0) {
        const childChunks = this.createSectionChunks(content, child);
        chunks.push(...childChunks);
      }
    }

    return chunks;
  }

  /**
   * Create individual section chunk
   */
  private createSectionChunk(
    content: ParsedContent,
    section: any
  ): DocumentChunk {
    let sectionContent = `${'#'.repeat(section.level)} ${section.title}\n\n`;
    sectionContent += section.content;

    // Add breadcrumb navigation
    const breadcrumb = this.buildBreadcrumb(section);
    if (breadcrumb) {
      sectionContent =
        `**Navigation**: ${breadcrumb}\n\n---\n\n` + sectionContent;
    }

    // Add child section summaries if they exist
    if (section.children.length > 0) {
      sectionContent += '\n\n## Subsections\n\n';
      for (const child of section.children) {
        sectionContent += `- **${child.title}**: ${child.content.slice(0, 100).trim()}...\n`;
      }
    }

    return {
      id: this.generateChunkId(
        content,
        section.title.toLowerCase().replace(/\s+/g, '-')
      ),
      content: sectionContent,
      metadata: {
        ...content.metadata,
        tags: [
          ...content.metadata.tags,
          'hierarchical',
          `level-${section.level}`,
          section.title.toLowerCase().replace(/\s+/g, '-'),
        ],
      },
    };
  }

  /**
   * Build breadcrumb navigation
   */
  private buildBreadcrumb(section: any): string {
    const path: string[] = [];
    let current = section;

    while (current.parent) {
      path.unshift(current.parent.title);
      current = current.parent;
    }

    path.push(section.title);
    return path.join(' > ');
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
