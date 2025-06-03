#!/usr/bin/env node

/**
 * PrivMX Documentation MCP Server
 * 
 * A Model Context Protocol server that provides AI assistants with semantic access
 * to PrivMX WebEndpoint documentation through vector embeddings and intelligent chunking.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ChunkingManager } from './chunking/chunking-manager.js';
import { JSONParser } from './parsers/json-parser.js';
import { MDXParser } from './parsers/mdx-parser.js';
import { DocumentationIndexer } from './scripts/index-docs.js';
import type { ParsedContent, DocumentChunk } from '@privmx/shared';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Server Configuration
 */
interface ServerConfig {
  name: string;
  version: string;
  maxChunkSize: number;
  overlapSize: number;
  chunkingStrategy: 'method-level' | 'context-aware' | 'hierarchical' | 'hybrid';
  dataPath: string;
}

const DEFAULT_CONFIG: ServerConfig = {
  name: 'privmx-docs',
  version: '1.0.0',
  maxChunkSize: 1500,
  overlapSize: 200,
  chunkingStrategy: 'hybrid',
  dataPath: path.join(__dirname, '../../../data'),
};

/**
 * Main PrivMX MCP Server Class
 */
class PrivMXMCPServer {
  private server: Server;
  private chunkingManager: ChunkingManager;
  private jsonParser: JSONParser;
  private mdxParser: MDXParser;
  private config: ServerConfig;
  private documentChunks: DocumentChunk[] = [];
  private chunksLoaded: boolean = false;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize components
    this.chunkingManager = new ChunkingManager();
    this.jsonParser = new JSONParser();
    this.mdxParser = new MDXParser();

    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documentation',
            description: 'Search PrivMX documentation semantically',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for finding relevant documentation',
                },
                filters: {
                  type: 'object',
                  properties: {
                    namespace: {
                      type: 'string',
                      description: 'Filter by namespace (Core, Threads, Stores, Inboxes, etc.)',
                    },
                    type: {
                      type: 'string',
                      enum: ['method', 'class', 'interface', 'type', 'example'],
                      description: 'Filter by content type',
                    },
                    importance: {
                      type: 'string',
                      enum: ['critical', 'high', 'medium', 'low'],
                      description: 'Filter by importance level',
                    },
                  },
                },
                limit: {
                  type: 'number',
                  default: 5,
                  description: 'Maximum number of results to return',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_method_details',
            description: 'Get detailed information about a specific API method',
            inputSchema: {
              type: 'object',
              properties: {
                methodName: {
                  type: 'string',
                  description: 'Full method name (e.g., "ThreadApi.createThread")',
                },
                includeExamples: {
                  type: 'boolean',
                  default: true,
                  description: 'Include code examples in the response',
                },
              },
              required: ['methodName'],
            },
          },
          {
            name: 'find_examples',
            description: 'Find code examples for specific use cases',
            inputSchema: {
              type: 'object',
              properties: {
                useCase: {
                  type: 'string',
                  description: 'Description of what you want to achieve (e.g., "create encrypted thread")',
                },
                namespace: {
                  type: 'string',
                  description: 'Optional namespace filter',
                },
              },
              required: ['useCase'],
            },
          },
          {
            name: 'get_workflow',
            description: 'Get complete workflow for complex tasks',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'string',
                  description: 'Task description (e.g., "setup PrivMX and create first thread")',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'troubleshoot',
            description: 'Get troubleshooting help for common issues',
            inputSchema: {
              type: 'object',
              properties: {
                issue: {
                  type: 'string',
                  description: 'Description of the problem you are experiencing',
                },
                context: {
                  type: 'string',
                  description: 'Additional context about when the issue occurs',
                },
              },
              required: ['issue'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Ensure chunks are loaded
        await this.ensureChunksLoaded();

        switch (name) {
          case 'search_documentation':
            return await this.handleSearchDocumentation(args as any);
          case 'get_method_details':
            return await this.handleGetMethodDetails(args as any);
          case 'find_examples':
            return await this.handleFindExamples(args as any);
          case 'get_workflow':
            return await this.handleGetWorkflow(args as any);
          case 'troubleshoot':
            return await this.handleTroubleshoot(args as any);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Ensure chunks are loaded from processed data
   */
  private async ensureChunksLoaded(): Promise<void> {
    if (this.chunksLoaded) return;

    try {
      const chunksFile = path.join(this.config.dataPath, 'processed-chunks.json');
      const chunksData = JSON.parse(await fs.readFile(chunksFile, 'utf-8'));
      this.documentChunks = chunksData.chunks || [];
      this.chunksLoaded = true;
      console.log(`📊 Loaded ${this.documentChunks.length} chunks from storage`);
    } catch (error) {
      console.warn('⚠️  No processed chunks found. Running indexing...');
      await this.reindexDocumentation();
    }
  }

  /**
   * Re-index documentation if no processed data exists
   */
  private async reindexDocumentation(): Promise<void> {
    const indexer = new DocumentationIndexer({
      outputDir: this.config.dataPath,
    });
    await indexer.index();
    await this.ensureChunksLoaded();
  }

  /**
   * Handle search_documentation tool
   */
  private async handleSearchDocumentation(args: {
    query: string;
    filters?: {
      namespace?: string;
      type?: string;
      importance?: string;
    };
    limit?: number;
  }) {
    const { query, filters = {}, limit = 5 } = args;

    // Simple text-based search (will be replaced with vector search in Phase 4)
    let matchingChunks = this.documentChunks.filter(chunk => {
      // Text matching
      const contentMatch = chunk.content.toLowerCase().includes(query.toLowerCase());
      const nameMatch = chunk.id.toLowerCase().includes(query.toLowerCase());
      
      if (!contentMatch && !nameMatch) return false;

      // Apply filters
      if (filters.namespace && chunk.metadata.namespace !== filters.namespace) return false;
      if (filters.type && chunk.metadata.type !== filters.type) return false;
      if (filters.importance && chunk.metadata.importance !== filters.importance) return false;

      return true;
    });

    // Sort by relevance (simple scoring)
    matchingChunks = matchingChunks
      .map(chunk => ({
        chunk,
        score: this.calculateRelevanceScore(chunk, query)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.chunk);

    if (matchingChunks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No results found for "${query}". Try broadening your search terms or check the available namespaces: Core, Threads, Stores, Inboxes, Crypto, Events.`,
          },
        ],
      };
    }

    const results = matchingChunks.map((chunk, index) => {
      const title = this.extractTitle(chunk.content) || chunk.id;
      const preview = this.extractPreview(chunk.content, 150);
      return `${index + 1}. **${title}** (${chunk.metadata.namespace})\n   ${preview}\n   Type: ${chunk.metadata.type} | Importance: ${chunk.metadata.importance}\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `Found ${matchingChunks.length} results for "${query}":\n\n${results.join('\n')}`,
        },
      ],
    };
  }

  /**
   * Handle get_method_details tool
   */
  private async handleGetMethodDetails(args: {
    methodName: string;
    includeExamples?: boolean;
  }) {
    const { methodName, includeExamples = true } = args;

    // Find method chunk
    const methodChunk = this.documentChunks.find(chunk => 
      chunk.metadata.type === 'method' && (
        chunk.id.includes(methodName.toLowerCase()) ||
        chunk.content.includes(methodName) ||
        (chunk.metadata.className && chunk.metadata.methodName && 
         `${chunk.metadata.className}.${chunk.metadata.methodName}` === methodName)
      )
    );

    if (!methodChunk) {
      return {
        content: [
          {
            type: 'text',
            text: `Method "${methodName}" not found. Available namespaces: Core, Threads, Stores, Inboxes, Crypto, Events.`,
          },
        ],
      };
    }

    let response = methodChunk.content;

    // Add related methods if available
    if (methodChunk.metadata.relatedMethods && methodChunk.metadata.relatedMethods.length > 0) {
      response += '\n\n## Related Methods\n\n';
      response += methodChunk.metadata.relatedMethods.map(method => `- ${method}`).join('\n');
    }

    // Add common mistakes if available
    if (methodChunk.metadata.commonMistakes && methodChunk.metadata.commonMistakes.length > 0) {
      response += '\n\n## Common Mistakes to Avoid\n\n';
      response += methodChunk.metadata.commonMistakes.map(mistake => `- ${mistake}`).join('\n');
    }

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  /**
   * Handle find_examples tool
   */
  private async handleFindExamples(args: {
    useCase: string;
    namespace?: string;
  }) {
    const { useCase, namespace } = args;

    // Find example chunks
    let exampleChunks = this.documentChunks.filter(chunk => {
      const hasExamples = chunk.content.includes('example') || chunk.content.includes('Example') || 
                         chunk.content.includes('```') || chunk.metadata.type === 'example';
      
      const matchesUseCase = chunk.content.toLowerCase().includes(useCase.toLowerCase());
      
      if (namespace && chunk.metadata.namespace !== namespace) return false;
      
      return hasExamples && matchesUseCase;
    });

    if (exampleChunks.length === 0) {
      // Fallback to method chunks that might have examples
      exampleChunks = this.documentChunks.filter(chunk => {
        return chunk.metadata.type === 'method' && 
               chunk.content.toLowerCase().includes(useCase.toLowerCase()) &&
               (!namespace || chunk.metadata.namespace === namespace);
      });
    }

    if (exampleChunks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No examples found for "${useCase}". Try different keywords or check specific namespaces.`,
          },
        ],
      };
    }

    const examples = exampleChunks.slice(0, 3).map((chunk, index) => {
      const title = this.extractTitle(chunk.content) || `Example ${index + 1}`;
      return `## ${title}\n\n${chunk.content}\n\n---\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `# Examples for "${useCase}"\n\n${examples.join('\n')}`,
        },
      ],
    };
  }

  /**
   * Handle get_workflow tool
   */
  private async handleGetWorkflow(args: { task: string }) {
    const { task } = args;

    // Find workflow-related chunks
    const workflowChunks = this.documentChunks.filter(chunk => {
      return chunk.content.toLowerCase().includes(task.toLowerCase()) ||
             chunk.metadata.tags.some(tag => task.toLowerCase().includes(tag.toLowerCase()));
    });

    if (workflowChunks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No specific workflow found for "${task}". Try searching for related methods or check the documentation index.`,
          },
        ],
      };
    }

    // Sort by importance and type
    workflowChunks.sort((a, b) => {
      const aScore = this.getImportanceScore(a.metadata.importance);
      const bScore = this.getImportanceScore(b.metadata.importance);
      return bScore - aScore;
    });

    const workflow = workflowChunks.slice(0, 5).map((chunk, index) => {
      const title = this.extractTitle(chunk.content) || `Step ${index + 1}`;
      const preview = this.extractPreview(chunk.content, 200);
      return `### ${index + 1}. ${title}\n\n${preview}\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `# Workflow: ${task}\n\n${workflow.join('\n')}`,
        },
      ],
    };
  }

  /**
   * Handle troubleshoot tool
   */
  private async handleTroubleshoot(args: {
    issue: string;
    context?: string;
  }) {
    const { issue, context } = args;

    // Find troubleshooting-related chunks
    const troubleshootingChunks = this.documentChunks.filter(chunk => {
      const hasTroubleshooting = chunk.content.toLowerCase().includes('troubleshoot') ||
                                chunk.content.toLowerCase().includes('error') ||
                                chunk.content.toLowerCase().includes('problem') ||
                                chunk.content.toLowerCase().includes('issue') ||
                                (chunk.metadata.commonMistakes && chunk.metadata.commonMistakes.length > 0);
      
      const matchesIssue = chunk.content.toLowerCase().includes(issue.toLowerCase());
      
      return hasTroubleshooting && matchesIssue;
    });

    if (troubleshootingChunks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No specific troubleshooting information found for "${issue}". Try searching for related methods or error messages.`,
          },
        ],
      };
    }

    const troubleshootingInfo = troubleshootingChunks.slice(0, 3).map((chunk, index) => {
      const title = this.extractTitle(chunk.content) || `Solution ${index + 1}`;
      return `## ${title}\n\n${chunk.content}\n\n---\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: `# Troubleshooting: ${issue}\n\n${context ? `**Context:** ${context}\n\n` : ''}${troubleshootingInfo.join('\n')}`,
        },
      ],
    };
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(chunk: DocumentChunk, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    // Exact title match
    const title = this.extractTitle(chunk.content)?.toLowerCase();
    if (title?.includes(queryLower)) score += 0.5;

    // Content frequency
    const matches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(matches * 0.1, 0.3);

    // Importance bonus
    const importanceScore = this.getImportanceScore(chunk.metadata.importance);
    score += importanceScore * 0.1;

    // Type bonus
    if (chunk.metadata.type === 'method') score += 0.1;

    return score;
  }

  /**
   * Extract title from chunk content
   */
  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1] : null;
  }

  /**
   * Extract preview from chunk content
   */
  private extractPreview(content: string, maxLength: number): string {
    // Remove markdown headers
    const cleanContent = content.replace(/^#{1,6}\s+.+$/gm, '').trim();
    
    // Get first paragraph or first maxLength characters
    const firstParagraph = cleanContent.split('\n\n')[0];
    if (firstParagraph.length <= maxLength) {
      return firstParagraph;
    }
    
    return firstParagraph.substring(0, maxLength) + '...';
  }

  /**
   * Get numeric score for importance
   */
  private getImportanceScore(importance: string): number {
    switch (importance) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  /**
   * Load and process documentation
   */
  async loadDocumentation(): Promise<void> {
    console.log('📚 Loading documentation...');
    await this.ensureChunksLoaded();
    console.log(`✅ Documentation loaded: ${this.documentChunks.length} chunks available`);
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    console.log(`🚀 Starting PrivMX MCP Server v${this.config.version}...`);
    
    // Load documentation
    await this.loadDocumentation();
    
    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('✅ PrivMX MCP Server is running!');
    console.log('📖 Available tools:');
    console.log('  - search_documentation: Search docs semantically');
    console.log('  - get_method_details: Get detailed method info');
    console.log('  - find_examples: Find code examples');
    console.log('  - get_workflow: Get step-by-step workflows');
    console.log('  - troubleshoot: Get troubleshooting help');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const server = new PrivMXMCPServer();
  await server.run();
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  });
}

export { PrivMXMCPServer }; 