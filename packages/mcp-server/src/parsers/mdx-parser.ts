/**
 * MDX Documentation Parser
 * Parses tutorial content from MDX files
 */

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import type {
  ParsedContent,
  ChunkMetadata,
  CodeExample,
  Workflow,
  WorkflowStep,
} from '@privmx/shared';

interface MDXFrontmatter {
  title: string;
  description?: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  category?: string;
  workflow?: boolean;
  order?: number;
  prerequisites?: string[];
  relatedMethods?: string[];
}

interface CodeBlock {
  language: string;
  code: string;
  info?: string;
  lineStart?: number;
  lineEnd?: number;
}

interface HeadingSection {
  level: number;
  title: string;
  content: string;
  codeBlocks: CodeBlock[];
  lineStart: number;
  lineEnd: number;
}

export class MDXParser {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });
  }

  /**
   * Parse MDX file content into structured data
   */
  async parseFile(content: string, filename: string): Promise<ParsedContent[]> {
    try {
      // Parse frontmatter and content
      const { data: frontmatter, content: markdownContent } = matter(content);
      const mdxFrontmatter = frontmatter as MDXFrontmatter;

      // Split content into sections
      const sections = this.extractSections(markdownContent);

      // Create base metadata
      const baseMetadata: Partial<ChunkMetadata> = {
        type: mdxFrontmatter.workflow ? 'tutorial' : 'example',
        namespace: mdxFrontmatter.category || 'general',
        importance: this.determineImportance(mdxFrontmatter),
        tags: this.buildTags(mdxFrontmatter, filename),
        sourceFile: filename,
        relatedMethods: mdxFrontmatter.relatedMethods,
      };

      const parsedContent: ParsedContent[] = [];

      // If it's a workflow, create workflow structure
      if (mdxFrontmatter.workflow) {
        const workflow = await this.parseWorkflow(
          sections,
          mdxFrontmatter,
          filename
        );
        parsedContent.push(workflow);
      } else {
        // Parse as individual sections/examples
        for (const section of sections) {
          const sectionContent = await this.parseSection(
            section,
            mdxFrontmatter,
            baseMetadata,
            filename
          );
          parsedContent.push(sectionContent);
        }
      }

      return parsedContent;
    } catch (error) {
      throw new Error(`Failed to parse MDX file ${filename}: ${error}`);
    }
  }

  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): HeadingSection[] {
    const lines = content.split('\n');
    const sections: HeadingSection[] = [];
    let currentSection: Partial<HeadingSection> | null = null;
    let currentContent: string[] = [];
    let inCodeBlock = false;
    let currentCodeBlock: Partial<CodeBlock> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch && !inCodeBlock) {
        // Save previous section if exists
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: currentContent.join('\n'),
            lineEnd: i - 1,
          } as HeadingSection);
        }

        // Start new section
        currentSection = {
          level: headingMatch[1].length,
          title: headingMatch[2],
          codeBlocks: [],
          lineStart: i,
        };
        currentContent = [];
        continue;
      }

      // Check for code blocks
      const codeBlockMatch = line.match(/^```(\w+)?(.*)$/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          // Start of code block
          inCodeBlock = true;
          currentCodeBlock = {
            language: codeBlockMatch[1] || 'text',
            info: codeBlockMatch[2].trim(),
            code: '',
            lineStart: i,
          };
        } else {
          // End of code block
          inCodeBlock = false;
          if (currentCodeBlock && currentSection) {
            currentCodeBlock.lineEnd = i;
            currentSection.codeBlocks = currentSection.codeBlocks || [];
            currentSection.codeBlocks.push(currentCodeBlock as CodeBlock);
          }
          currentCodeBlock = null;
        }
        currentContent.push(line);
        continue;
      }

      // Regular content
      if (inCodeBlock && currentCodeBlock) {
        currentCodeBlock.code += (currentCodeBlock.code ? '\n' : '') + line;
      }

      currentContent.push(line);
    }

    // Save final section
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: currentContent.join('\n'),
        lineEnd: lines.length - 1,
      } as HeadingSection);
    }

    return sections;
  }

  /**
   * Parse content as a workflow
   */
  private async parseWorkflow(
    sections: HeadingSection[],
    frontmatter: MDXFrontmatter,
    filename: string
  ): Promise<ParsedContent> {
    const steps: WorkflowStep[] = [];

    // Find step sections (usually h2 or h3)
    const stepSections = sections.filter(
      (s) =>
        s.level >= 2 &&
        s.level <= 3 &&
        (s.title.match(/step|krok|\d+\./i) || s.codeBlocks.length > 0)
    );

    for (let i = 0; i < stepSections.length; i++) {
      const section = stepSections[i];
      const step: WorkflowStep = {
        step: i + 1,
        title: section.title,
        description: this.extractStepDescription(section.content),
        prerequisites: this.extractPrerequisites(section.content),
        nextSteps:
          i < stepSections.length - 1 ? [stepSections[i + 1].title] : undefined,
      };

      // Add main code example if exists
      if (section.codeBlocks.length > 0) {
        step.code = {
          language: section.codeBlocks[0].language,
          code: section.codeBlocks[0].code,
          explanation:
            section.codeBlocks[0].info || `Code for ${section.title}`,
        };
      }

      steps.push(step);
    }

    const metadata: ChunkMetadata = {
      type: 'tutorial',
      namespace: frontmatter.category || 'workflows',
      importance: this.determineImportance(frontmatter),
      tags: this.buildTags(frontmatter, filename),
      sourceFile: filename,
      relatedMethods: frontmatter.relatedMethods,
    };

    return {
      type: 'example',
      name: frontmatter.title,
      description:
        frontmatter.description ||
        `Step-by-step workflow: ${frontmatter.title}`,
      content: this.buildWorkflowContent(steps, frontmatter),
      metadata,
    };
  }

  /**
   * Parse individual section as content
   */
  private async parseSection(
    section: HeadingSection,
    frontmatter: MDXFrontmatter,
    baseMetadata: Partial<ChunkMetadata>,
    filename: string
  ): Promise<ParsedContent> {
    const examples: CodeExample[] = section.codeBlocks.map((block) => ({
      language: block.language,
      code: block.code,
      explanation: block.info || `Example code from ${section.title}`,
      title: `${section.title} - ${block.language} example`,
    }));

    const metadata: ChunkMetadata = {
      ...baseMetadata,
      lineNumber: section.lineStart,
      useCases: this.extractUseCases(section.content),
    } as ChunkMetadata;

    return {
      type: 'example',
      name: section.title,
      description: this.extractSectionDescription(section.content),
      content: this.buildSectionContent(section, frontmatter),
      metadata,
      examples,
    };
  }

  /**
   * Determine importance based on frontmatter
   */
  private determineImportance(
    frontmatter: MDXFrontmatter
  ): ChunkMetadata['importance'] {
    if (frontmatter.difficulty === 'beginner') return 'critical';
    if (frontmatter.difficulty === 'intermediate') return 'high';
    if (frontmatter.workflow) return 'high';
    return 'medium';
  }

  /**
   * Build tags array
   */
  private buildTags(frontmatter: MDXFrontmatter, filename: string): string[] {
    const tags: string[] = [];

    // Add frontmatter tags
    if (frontmatter.tags) {
      tags.push(...frontmatter.tags);
    }

    // Add category
    if (frontmatter.category) {
      tags.push(frontmatter.category);
    }

    // Add difficulty
    if (frontmatter.difficulty) {
      tags.push(frontmatter.difficulty);
    }

    // Add filename-based tag
    const fileTag = filename
      .replace(/\.mdx?$/, '')
      .replace(/[_-]/g, ' ')
      .toLowerCase();
    tags.push(fileTag);

    // Add type tags
    if (frontmatter.workflow) {
      tags.push('workflow', 'tutorial');
    } else {
      tags.push('example', 'guide');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract step description from content
   */
  private extractStepDescription(content: string): string {
    // Remove headings and code blocks, get first paragraph
    const lines = content.split('\n');
    const contentLines = lines.filter(
      (line) =>
        !line.startsWith('#') &&
        !line.startsWith('```') &&
        line.trim().length > 0
    );

    return contentLines.slice(0, 3).join(' ').substring(0, 200) + '...';
  }

  /**
   * Extract prerequisites from content
   */
  private extractPrerequisites(content: string): string[] {
    const prereqMatch = content.match(
      /(?:prerequisites?|requirements?|before|needed):?\s*(.+)/i
    );
    if (prereqMatch) {
      return prereqMatch[1]
        .split(/[,;]/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Extract section description
   */
  private extractSectionDescription(content: string): string {
    const lines = content.split('\n');
    const firstParagraph = lines.find(
      (line) =>
        line.trim().length > 0 &&
        !line.startsWith('#') &&
        !line.startsWith('```')
    );

    return firstParagraph || 'Documentation section';
  }

  /**
   * Extract use cases from content
   */
  private extractUseCases(content: string): string[] {
    const useCaseMatches = content.match(
      /(?:use case|usage|when to use|good for):?\s*(.+)/gi
    );
    if (useCaseMatches) {
      return useCaseMatches.map((match) =>
        match
          .replace(/(?:use case|usage|when to use|good for):?\s*/i, '')
          .trim()
      );
    }
    return [];
  }

  /**
   * Build enhanced content for a workflow
   */
  private buildWorkflowContent(
    steps: WorkflowStep[],
    frontmatter: MDXFrontmatter
  ): string {
    const stepsContent = steps
      .map(
        (step, index) => `
## Step ${step.step}: ${step.title}

${step.description}

${
  step.code
    ? `### Code Example
\`\`\`${step.code.language}
${step.code.code}
\`\`\`

${step.code.explanation}`
    : ''
}

${
  step.prerequisites && step.prerequisites.length > 0
    ? `### Prerequisites
${step.prerequisites.map((p) => `- ${p}`).join('\n')}`
    : ''
}
    `
      )
      .join('\n\n');

    return `
# ${frontmatter.title}

${frontmatter.description || 'Complete workflow tutorial'}

${frontmatter.difficulty ? `**Difficulty:** ${frontmatter.difficulty}` : ''}
${frontmatter.tags ? `**Tags:** ${frontmatter.tags.join(', ')}` : ''}

## Overview
This tutorial provides a step-by-step guide to ${frontmatter.title.toLowerCase()}.

${stepsContent}

## Summary
You have successfully completed the ${frontmatter.title} workflow. 
${
  steps.length > 0 && steps[steps.length - 1].nextSteps
    ? `Next, you might want to explore: ${steps[steps.length - 1].nextSteps!.join(', ')}`
    : 'You can now apply these techniques to your own projects.'
}
    `.trim();
  }

  /**
   * Build enhanced content for a section
   */
  private buildSectionContent(
    section: HeadingSection,
    frontmatter: MDXFrontmatter
  ): string {
    const codeExamples = section.codeBlocks
      .map(
        (block) => `
### ${block.language.toUpperCase()} Example
\`\`\`${block.language}
${block.code}
\`\`\`
${block.info ? `\n*${block.info}*` : ''}
    `
      )
      .join('\n');

    return `
# ${section.title}

${this.extractSectionDescription(section.content)}

${frontmatter.difficulty ? `**Difficulty:** ${frontmatter.difficulty}` : ''}
${frontmatter.category ? `**Category:** ${frontmatter.category}` : ''}

## Content
${section.content.replace(/```[\s\S]*?```/g, '')}

${codeExamples}

## Related Information
${
  frontmatter.relatedMethods
    ? `**Related methods:** ${frontmatter.relatedMethods.join(', ')}`
    : 'This example demonstrates practical usage patterns for PrivMX development.'
}
    `.trim();
  }
}
