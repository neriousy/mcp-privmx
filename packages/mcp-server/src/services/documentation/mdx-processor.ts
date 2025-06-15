/**
 * MDX Processor Service
 *
 * Handles parsing and processing of MDX documentation files for AI-accessible knowledge base.
 * Uses existing remark ecosystem and gray-matter for robust MDX processing.
 */

import { readFile } from 'fs/promises';
import { join, relative, basename, dirname } from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type {
  ParsedMDXDocument,
  DocumentMetadata,
  ProcessedContent,
  CodeBlock,
} from '../../types/documentation-types.js';
import { FrontmatterSchema } from './frontmatter-schema.js';
import { startSpan } from '../../common/otel.js';

// Define minimal types for AST nodes we need (avoiding mdast dependency)
interface CodeNode {
  type: 'code';
  lang?: string;
  value: string;
}

interface LinkNode {
  type: 'link';
  url: string;
}

export class MDXProcessorService {
  private remarkProcessor: any; // Using any to avoid complex type issues

  constructor() {
    this.remarkProcessor = remark().use(remarkMdx).use(remarkGfm);
  }

  /**
   * Parse a single MDX file and extract all relevant information
   */
  async parseMDXFile(filePath: string): Promise<ParsedMDXDocument> {
    return startSpan('docs.parseMDXFile', async () => {
      try {
        const rawContent = await readFile(filePath, 'utf-8');
        const { data: frontmatter, content: markdownContent } =
          matter(rawContent);

        // Validate frontmatter
        const fmValidation = FrontmatterSchema.safeParse(frontmatter);
        if (!fmValidation.success) {
          console.warn(
            `⚠️  Frontmatter validation failed for ${filePath}:`,
            fmValidation.error.flatten().fieldErrors
          );
        }

        const frontmatterValid = fmValidation.success
          ? fmValidation.data
          : frontmatter;

        // Generate document ID from file path
        const id = this.generateDocumentId(filePath);

        // Extract metadata from frontmatter and file path
        const metadata = this.extractMetadata(frontmatterValid, filePath);

        // Process markdown content
        const processedContent =
          await this.processMarkdownContent(markdownContent);

        // Generate content hash for change detection
        const contentHash = this.generateContentHash(rawContent);

        return {
          id,
          metadata,
          content: processedContent,
          frontmatter,
          rawContent,
          contentHash,
        };
      } catch (error) {
        console.error(`Failed to parse MDX file ${filePath}:`, error);
        throw new Error(
          `MDX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Extract metadata from frontmatter and derive additional info from file path
   */
  extractMetadata(
    frontmatter: Record<string, any>,
    filePath: string
  ): DocumentMetadata {
    const relativePath = relative(process.cwd(), filePath);
    const pathParts = relativePath.split('/');

    // Extract language from file path with proper language mapping
    let language: string | undefined;

    if (pathParts.includes('mdx')) {
      const mdxIndex = pathParts.indexOf('mdx');
      const potentialLanguage = pathParts[mdxIndex + 1];

      // Map directory names to proper language identifiers
      const languageMap: Record<string, string> = {
        js: 'javascript',
        javascript: 'javascript',
        cpp: 'cpp',
        java: 'java',
        kotlin: 'kotlin',
        swift: 'swift',
        csharp: 'csharp',
        'c#': 'csharp',
      };

      // Only set language if it's a recognized programming language
      // 'start' directory contains general documentation, not language-specific
      if (
        potentialLanguage &&
        potentialLanguage !== 'start' &&
        languageMap[potentialLanguage]
      ) {
        language = languageMap[potentialLanguage];
      } else if (potentialLanguage === 'start') {
        language = undefined; // General documentation, no specific language
      } else if (potentialLanguage && potentialLanguage !== 'start') {
        // For other directories, use as-is but normalize
        language = potentialLanguage.toLowerCase();
      }
    }

    // Determine namespace based on file path and content
    const namespace = this.determineNamespace(filePath, frontmatter);

    // Determine category based on file path
    const category = this.determineCategory(filePath, frontmatter);

    // Determine skill level from content or path
    const skillLevel = this.determineSkillLevel(frontmatter, filePath);

    return {
      title: frontmatter.title || basename(filePath, '.mdx'),
      description: frontmatter.description,
      language: frontmatter.language || language,
      framework: frontmatter.framework,
      skillLevel,
      tags: frontmatter.tags || [],
      filePath: relativePath,
      lastModified: new Date(),
      category,
      namespace,
    };
  }

  /**
   * Process markdown content to extract code blocks, links, and concepts
   */
  async processMarkdownContent(content: string): Promise<ProcessedContent> {
    const ast = this.remarkProcessor.parse(content);

    const codeBlocks: CodeBlock[] = [];
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const concepts: string[] = [];
    const apiReferences: string[] = [];

    let lineNumber = 1;

    // Visit all nodes in the AST to extract relevant information
    visit(ast, (node, index, parent) => {
      // Extract code blocks
      if (node.type === 'code') {
        const codeNode = node as CodeNode;
        codeBlocks.push({
          language: codeNode.lang || 'text',
          code: codeNode.value,
          title: this.extractCodeTitle(codeNode, parent, index ?? null),
          startLine: lineNumber,
          endLine: lineNumber + codeNode.value.split('\n').length - 1,
          isComplete: this.isCompleteExample(codeNode.value, codeNode.lang),
        });
      }

      // Extract links
      if (node.type === 'link') {
        const linkNode = node as LinkNode;
        if (linkNode.url.startsWith('http')) {
          externalLinks.push(linkNode.url);
        } else {
          internalLinks.push(linkNode.url);
        }
      }

      // Update line counter (simplified)
      if (node.type === 'text' && typeof node.value === 'string') {
        lineNumber += node.value.split('\n').length - 1;
      }
    });

    // Extract concepts and API references from content
    concepts.push(...this.extractConcepts(content));
    apiReferences.push(...this.extractAPIReferences(content));

    return {
      markdown: content,
      codeBlocks,
      internalLinks: [...new Set(internalLinks)],
      externalLinks: [...new Set(externalLinks)],
      concepts: [...new Set(concepts)],
      apiReferences: [...new Set(apiReferences)],
    };
  }

  /**
   * Generate unique document ID from file path
   */
  private generateDocumentId(filePath: string): string {
    const relativePath = relative(process.cwd(), filePath);
    return relativePath.replace(/[/\\]/g, '-').replace(/\.mdx$/, '');
  }

  /**
   * Determine namespace based on file path and content
   */
  private determineNamespace(
    filePath: string,
    frontmatter: Record<string, any>
  ): string {
    if (frontmatter.namespace) return frontmatter.namespace;

    const path = filePath.toLowerCase();

    if (path.includes('/threads/')) return 'Threads';
    if (path.includes('/stores/')) return 'Stores';
    if (path.includes('/inboxes/')) return 'Inboxes';
    if (path.includes('/start/')) return 'Core';
    if (path.includes('/events/')) return 'Events';
    if (path.includes('/policies/')) return 'Policies';

    return 'General';
  }

  /**
   * Determine document category based on file path and content
   */
  private determineCategory(
    filePath: string,
    frontmatter: Record<string, any>
  ): string {
    if (frontmatter.category) return frontmatter.category;

    const path = filePath.toLowerCase();
    const filename = basename(filePath, '.mdx').toLowerCase();

    if (
      filename.includes('introduction') ||
      filename.includes('getting-started')
    )
      return 'tutorial';
    if (filename.includes('concept') || path.includes('/concepts/'))
      return 'concept';
    if (filename.includes('guide') || path.includes('/guides/')) return 'guide';
    if (filename.includes('api') || filename.includes('reference'))
      return 'api';
    if (path.includes('/start/')) return 'getting-started';

    return 'documentation';
  }

  /**
   * Determine skill level from content or path
   */
  private determineSkillLevel(
    frontmatter: Record<string, any>,
    filePath: string
  ): 'beginner' | 'intermediate' | 'advanced' | undefined {
    if (frontmatter.skillLevel) return frontmatter.skillLevel;

    const path = filePath.toLowerCase();
    const filename = basename(filePath, '.mdx').toLowerCase();

    if (
      filename.includes('introduction') ||
      filename.includes('getting-started') ||
      filename.includes('first-app')
    ) {
      return 'beginner';
    }

    if (
      filename.includes('advanced') ||
      filename.includes('custom-') ||
      filename.includes('policy-builders')
    ) {
      return 'advanced';
    }

    if (path.includes('/start/')) return 'beginner';

    return 'intermediate'; // Default for most documentation
  }

  /**
   * Extract title for code block from surrounding context
   */
  private extractCodeTitle(
    codeNode: CodeNode,
    parent: any,
    index: number | null
  ): string | undefined {
    // Look for preceding text or heading that might describe the code
    if (parent && parent.children && index !== null && index > 0) {
      const prevNode = parent.children[index - 1];
      if (prevNode.type === 'heading') {
        return prevNode.children?.[0]?.value;
      }
      if (prevNode.type === 'paragraph') {
        const text = prevNode.children?.[0]?.value;
        if (text && text.length < 100) {
          return text;
        }
      }
    }
    return undefined;
  }

  /**
   * Determine if code block is a complete, runnable example
   */
  private isCompleteExample(code: string, language?: string): boolean {
    if (!language || language === 'text') return false;

    const lowerCode = code.toLowerCase();

    // Check for common indicators of complete examples
    if (
      language === 'js' ||
      language === 'javascript' ||
      language === 'typescript'
    ) {
      return (
        lowerCode.includes('import') ||
        lowerCode.includes('require') ||
        lowerCode.includes('function') ||
        lowerCode.includes('const') ||
        lowerCode.includes('await endpoint.setup')
      );
    }

    if (language === 'cpp' || language === 'c++') {
      return lowerCode.includes('#include') || lowerCode.includes('int main');
    }

    if (language === 'java') {
      return lowerCode.includes('public class') || lowerCode.includes('import');
    }

    if (language === 'csharp' || language === 'cs' || language === 'c#') {
      return lowerCode.includes('using') || lowerCode.includes('class');
    }

    return code.split('\n').length > 3; // Multi-line code likely more complete
  }

  /**
   * Extract key concepts mentioned in the content
   */
  private extractConcepts(content: string): string[] {
    const concepts: string[] = [];
    const lowerContent = content.toLowerCase();

    // PrivMX-specific concepts
    const privmxConcepts = [
      'endpoint',
      'bridge',
      'context',
      'thread',
      'store',
      'inbox',
      'encryption',
      'decryption',
      'private key',
      'public key',
      'message',
      'file',
      'policy',
      'acl',
      'notification',
      'web workers',
      'webassembly',
      'solution id',
    ];

    for (const concept of privmxConcepts) {
      if (lowerContent.includes(concept)) {
        concepts.push(concept);
      }
    }

    return concepts;
  }

  /**
   * Extract API method references from content
   */
  private extractAPIReferences(content: string): string[] {
    const apiReferences: string[] = [];

    // Match patterns like "ThreadApi.createThread", "Endpoint.connect", etc.
    const apiPatterns = [
      /(\w+Api\.\w+)/g,
      /(\w+\.\w+\(\))/g,
      /(Endpoint\.\w+)/g,
      /(EventQueue\.\w+)/g,
    ];

    for (const pattern of apiPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        apiReferences.push(...matches);
      }
    }

    return [...new Set(apiReferences)];
  }

  /**
   * Generate hash of content for change detection
   */
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
