#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { APIKnowledgeService } from './services/api-knowledge-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * PrivMX Code Generation MCP Server - Option A
 * Fast, deterministic API knowledge graph with code generation capabilities
 */
class LangChainPrivMXServer {
  private server: Server;
  private docService: APIKnowledgeService;
  private initialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'privmx-code-generator',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize API Knowledge Service (Option A)
    this.docService = new APIKnowledgeService({
      specPath: process.env.SPEC_PATH || 'spec',
      supportedLanguages: [
        'javascript',
        'typescript',
        'java',
        'swift',
        'cpp',
        'csharp',
      ],
    });

    this.setupHandlers();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await this.docService.initialize();
    this.initialized = true;
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_documentation',
            description: 'Search PrivMX documentation using semantic AI',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'What you want to find in the PrivMX documentation',
                },
                filters: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['json-api', 'mdx', 'markdown'],
                      description: 'Filter by document type',
                    },
                    namespace: {
                      type: 'string',
                      description:
                        'Filter by namespace (e.g., "Core", "Threads", "Stores")',
                    },
                  },
                },
                limit: {
                  type: 'number',
                  default: 5,
                  description: 'Maximum number of results',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_api_methods',
            description: 'Find specific API methods and endpoints',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'Method name or functionality you are looking for',
                },
                className: {
                  type: 'string',
                  description: 'Optional: specific class to search within',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of results',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_classes',
            description: 'Find API classes and schemas',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Class name or type you are looking for',
                },
                namespace: {
                  type: 'string',
                  description: 'Optional: specific namespace to search within',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of results',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'search_guides',
            description: 'Find documentation guides and tutorials',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Topic or guide you are looking for',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of results',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_related_content',
            description: 'Find content related to a specific topic',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description:
                    'Content or topic to find related information for',
                },
                limit: {
                  type: 'number',
                  default: 5,
                  description: 'Maximum number of results',
                },
              },
              required: ['content'],
            },
          },
          {
            name: 'index_documentation',
            description: 'Re-index PrivMX documentation (admin only)',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description:
                    'Path to documentation to index (defaults to /spec)',
                },
                force: {
                  type: 'boolean',
                  default: false,
                  description: 'Force re-indexing even if up to date',
                },
              },
            },
          },
          {
            name: 'discover_api',
            description: 'Find PrivMX APIs for specific functionality',
            inputSchema: {
              type: 'object',
              properties: {
                functionality: {
                  type: 'string',
                  description:
                    'What you want to accomplish (e.g., "create secure thread", "upload file")',
                },
                language: {
                  type: 'string',
                  enum: [
                    'javascript',
                    'typescript',
                    'java',
                    'swift',
                    'cpp',
                    'csharp',
                  ],
                  description: 'Preferred programming language',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of results',
                },
              },
              required: ['functionality'],
            },
          },
          {
            name: 'generate_setup',
            description: 'Generate PrivMX connection and setup code',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: [
                    'javascript',
                    'typescript',
                    'java',
                    'swift',
                    'cpp',
                    'csharp',
                  ],
                  description: 'Target programming language',
                },
                features: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['threads', 'stores', 'inboxes', 'crypto'],
                  },
                  description: 'PrivMX features to include',
                },
              },
              required: ['language'],
            },
          },
          {
            name: 'list_workflow_templates',
            description: 'List all available workflow templates (Phase 4)',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  enum: [
                    'messaging',
                    'file-sharing',
                    'feedback',
                    'collaboration',
                    'full-stack',
                  ],
                  description: 'Filter by workflow category',
                },
              },
            },
          },
          {
            name: 'get_workflow_template',
            description:
              'Get detailed information about a specific workflow template',
            inputSchema: {
              type: 'object',
              properties: {
                templateId: {
                  type: 'string',
                  description:
                    'Workflow template ID (e.g., secure-messaging-app)',
                },
              },
              required: ['templateId'],
            },
          },
          {
            name: 'generate_workflow',
            description:
              'Generate complete workflow application with all files (Phase 4)',
            inputSchema: {
              type: 'object',
              properties: {
                templateId: {
                  type: 'string',
                  description:
                    'Template ID (use list_workflow_templates to see available options)',
                },
                language: {
                  type: 'string',
                  enum: ['javascript', 'typescript', 'java', 'swift', 'csharp'],
                  description: 'Target programming language',
                },
                features: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Specific features to include (optional)',
                },
                customizations: {
                  type: 'object',
                  description: 'Custom settings and configurations',
                },
              },
              required: ['templateId', 'language'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.ensureInitialized();

        switch (name) {
          case 'search_documentation':
            return await this.handleSearchDocumentation(args);

          case 'search_api_methods':
            return await this.handleSearchApiMethods(args);

          case 'search_classes':
            return await this.handleSearchClasses(args);

          case 'search_guides':
            return await this.handleSearchGuides(args);

          case 'get_related_content':
            return await this.handleGetRelatedContent(args);

          case 'index_documentation':
            return await this.handleIndexDocumentation(args);

          case 'discover_api':
            return await this.handleDiscoverAPI(args);

          case 'generate_setup':
            return await this.handleGenerateSetup(args);

          case 'list_workflow_templates':
            return await this.handleListWorkflowTemplates(args);

          case 'get_workflow_template':
            return await this.handleGetWorkflowTemplate(args);

          case 'generate_workflow':
            return await this.handleGenerateWorkflow(args);

          default:
            throw new McpError(-32601, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error in ${name}:`, error);
        throw new McpError(
          -32603,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleSearchDocumentation(args: any) {
    const { query, filters = {}, limit = 5 } = args;

    const results = await this.docService.search(query, {
      limit,
      ...filters,
    });

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results,
            `Found ${results.length} results for "${query}":`
          ),
        },
      ],
    };
  }

  private async handleSearchApiMethods(args: any) {
    const { query, className, limit = 10 } = args;

    const results = await this.docService.searchMethods(query, className);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results.slice(0, Number(limit)),
            `Found ${results.length} API methods for "${query}":`
          ),
        },
      ],
    };
  }

  private async handleSearchClasses(args: any) {
    const { query, namespace, limit = 10 } = args;

    const results = await this.docService.searchClasses(query, namespace);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results.slice(0, Number(limit)),
            `Found ${results.length} classes/schemas for "${query}":`
          ),
        },
      ],
    };
  }

  private async handleSearchGuides(args: any) {
    const { query, limit = 10 } = args;

    const results = await this.docService.searchDocumentation(query);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results.slice(0, Number(limit)),
            `Found ${results.length} guides for "${query}":`
          ),
        },
      ],
    };
  }

  private async handleGetRelatedContent(args: any) {
    const { content, limit = 5 } = args;

    const results = await this.docService.getRelatedContent(content, limit);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results,
            `Found ${results.length} related content items:`
          ),
        },
      ],
    };
  }

  private async handleIndexDocumentation(args: any) {
    const { path = 'spec', force = false } = args;

    try {
      // If force is true, clear the collection first
      if (force) {
        await this.docService.clearCollection();
      }

      // Process the documentation directory
      const fullPath = process.env.SPEC_PATH || path;
      const results = await this.docService.processDirectory(fullPath);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Documentation indexing completed!
            
📊 Results:
- Documents indexed: ${results.indexed}
- Documents updated: ${results.updated}
- Errors: ${results.errors}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private async handleDiscoverAPI(args: any) {
    const { functionality, language, limit = 10 } = args;

    const results = await this.docService.discoverAPI(functionality, language);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(
            results.slice(0, Number(limit)),
            `Found ${results.length} APIs for "${functionality}":`
          ),
        },
      ],
    };
  }

  private async handleGenerateSetup(args: any) {
    const { language, features = [] } = args;

    const code = this.docService.generateSetupCode(language, features);

    return {
      content: [
        {
          type: 'text',
          text: `## PrivMX Setup Code (${language})

\`\`\`${language}
${code}
\`\`\`

This setup code will initialize PrivMX and establish a connection to the Bridge server.`,
        },
      ],
    };
  }

  private async handleListWorkflowTemplates(args: any) {
    const { category } = args;

    const templates = category
      ? this.docService.getWorkflowTemplatesByCategory(category)
      : this.docService.getWorkflowTemplates();

    let output = `## Available Workflow Templates ${category ? `(${category})` : ''}\n\n`;

    if (templates.length === 0) {
      output += '📭 No templates found for the specified criteria.';
    } else {
      templates.forEach((template, index) => {
        output += `${index + 1}. **${template.name}** (\`${template.id}\`)\n`;
        output += `   📂 Category: ${template.category}\n`;
        output += `   🔧 Language: ${template.language}\n`;
        output += `   📝 ${template.description}\n`;
        output += `   ⚡ Features: ${template.features.length} (${template.features.map((f: any) => f.name).join(', ')})\n\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async handleGetWorkflowTemplate(args: any) {
    const { templateId } = args;

    const template = this.docService.getWorkflowTemplate(templateId);

    if (!template) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Template '${templateId}' not found. Use list_workflow_templates to see available options.`,
          },
        ],
      };
    }

    let output = `## ${template.name}\n\n`;
    output += `**ID:** \`${template.id}\`\n`;
    output += `**Category:** ${template.category}\n`;
    output += `**Language:** ${template.language}\n`;
    output += `**Description:** ${template.description}\n\n`;

    output += `### Features (${template.features.length})\n\n`;
    template.features.forEach((feature: any, index: number) => {
      output += `${index + 1}. **${feature.name}** (${feature.complexity})\n`;
      output += `   📝 ${feature.description}\n`;
      output += `   🔧 APIs: ${feature.apis.join(', ')}\n\n`;
    });

    output += `### Dependencies (${template.dependencies.length})\n\n`;
    template.dependencies.forEach((dep: any) => {
      output += `- **${dep.name}** ${dep.version || 'latest'} (${dep.type})\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }

  private async handleGenerateWorkflow(args: any) {
    const { templateId, language, features, customizations } = args;

    try {
      const result = await this.docService.generateWorkflow(
        templateId,
        language,
        features,
        customizations
      );

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Workflow generation failed: ${result.error}`,
            },
          ],
        };
      }

      let output = `# ${result.template.name} - Generated Application\n\n`;
      output += `**Template:** ${result.template.id}\n`;
      output += `**Language:** ${result.template.language}\n`;
      output += `**Features:** ${result.template.features.length}\n`;
      output += `**Files Generated:** ${result.generatedFiles.length}\n\n`;

      // Show generated files
      output += `## Generated Files\n\n`;
      result.generatedFiles.forEach((file: any, index: number) => {
        output += `${index + 1}. **${file.path}** (${file.type})\n`;
      });

      // Show setup instructions
      output += `\n## Setup Instructions\n\n${result.instructions}\n\n`;

      // Show next steps
      output += `## Next Steps\n\n`;
      result.nextSteps.forEach((step: string, index: number) => {
        output += `${index + 1}. ${step}\n`;
      });

      // Show first few files content
      output += `\n## Sample Generated Code\n\n`;
      const sampleFiles = result.generatedFiles.slice(0, 3);
      sampleFiles.forEach((file: any) => {
        output += `### ${file.path}\n\n`;
        output += `\`\`\`${this.getLanguageForFile(file.path, result.template.language)}\n`;
        output += file.content.substring(0, 1000);
        if (file.content.length > 1000) {
          output += '\n\n// ... (truncated for display)\n';
        }
        output += '\n```\n\n';
      });

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Workflow generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private getLanguageForFile(
    filePath: string,
    defaultLanguage: string
  ): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      java: 'java',
      swift: 'swift',
      cs: 'csharp',
      json: 'json',
      md: 'markdown',
    };
    return langMap[ext || ''] || defaultLanguage;
  }

  private formatSearchResults(results: any[], title: string): string {
    if (results.length === 0) {
      return `${title}\n\n📭 No results found.`;
    }

    let output = `${title}\n\n`;

    results.forEach((result, index) => {
      output += `${index + 1}. **${this.extractTitle(result)}**\n`;

      if (result.score) {
        output += `   📊 Relevance: ${(result.score * 100).toFixed(1)}%\n`;
      }

      if (result.metadata?.type) {
        output += `   📂 Type: ${result.metadata.type}`;
        if (result.metadata?.namespace) {
          output += ` | Namespace: ${result.metadata.namespace}`;
        }
        output += '\n';
      }

      // Add content preview
      const content = result.content || '';
      const preview =
        content.length > 300 ? content.substring(0, 300) + '...' : content;
      output += `   📝 ${preview}\n\n`;
    });

    return output;
  }

  private extractTitle(result: any): string {
    const metadata = result.metadata || {};

    if (metadata.title) return metadata.title;
    if (metadata.methodName) return metadata.methodName;
    if (metadata.className) return metadata.className;
    if (metadata.headers?.[0]) return metadata.headers[0];

    // Extract from content
    const content = result.content || '';
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        return trimmed.replace(/^#+\s*/, '');
      }
    }

    return 'Documentation';
  }

  async run(): Promise<void> {
    console.log('🚀 Starting PrivMX Code Generation MCP Server (Option A)...');

    // Note: No longer requires OPENAI_API_KEY for Option A

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('✅ PrivMX Code Generation MCP Server running');
  }
}

// Start the server
async function main() {
  const server = new LangChainPrivMXServer();
  await server.run();
}

main().catch((error) => {
  console.error('💥 Server failed:', error);
  process.exit(1);
});
