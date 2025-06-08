import { createMcpHandler } from '@vercel/mcp-adapter';
import { z } from 'zod';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { APIKnowledgeService } from '@privmx/mcp-server/dist/services/api-knowledge-service.js';
import {
  SearchResult,
  APIKnowledgeServiceConfig,
} from '@privmx/mcp-server/dist/services/types.js';
import { WorkflowTemplate } from '@privmx/mcp-server/dist/services/feature-generators/workflow-types.js';

// Custom logger for detailed MCP debugging
const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `🔍 [MCP INFO] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  error: (message: string, error?: any) => {
    console.error(`❌ [MCP ERROR] ${message}`, error);
  },
  debug: (message: string, data?: any) => {
    console.log(
      `🐛 [MCP DEBUG] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  tool: (toolName: string, input: any, output?: any) => {
    console.log(`🛠️  [MCP TOOL] ${toolName}`);
    console.log(`📥 INPUT:`, JSON.stringify(input, null, 2));
    if (output) {
      console.log(`📤 OUTPUT:`, JSON.stringify(output, null, 2));
    }
  },
};

// Initialize the API Knowledge Service
const apiKnowledgeService = new APIKnowledgeService({
  specPath: path.join(process.cwd(), 'spec'),
  supportedLanguages: [
    'javascript',
    'typescript',
    'java',
    'swift',
    'cpp',
    'csharp',
  ],
});

// Initialize the service (async initialization)
let initPromise: Promise<void> | null = null;
const ensureInitialized = async () => {
  if (!initPromise) {
    initPromise = apiKnowledgeService.initialize();
  }
  await initPromise;
};

const handler = createMcpHandler(
  async (server) => {
    logger.info('Initializing PrivMX MCP Server with comprehensive tools');

    // Tool 1: Search PrivMX Documentation
    server.tool(
      'search_documentation',
      'Search PrivMX documentation using semantic AI',
      {
        query: z
          .string()
          .describe('What you want to find in the PrivMX documentation'),
        filters: z
          .object({
            type: z
              .enum(['json-api', 'mdx', 'markdown'])
              .optional()
              .describe('Filter by document type'),
            namespace: z
              .string()
              .optional()
              .describe(
                'Filter by namespace (e.g., "Core", "Threads", "Stores")'
              ),
          })
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(5)
          .describe('Maximum number of results'),
      },
      async ({ query, filters, limit }) => {
        logger.tool('search_documentation', { query, filters, limit });

        try {
          await ensureInitialized();
          const results = await apiKnowledgeService.searchDocumentation(
            query,
            filters,
            limit
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `Found ${results.length} documentation results for "${query}":\n\n${results
                  .map(
                    (result: SearchResult, i: number) =>
                      `${i + 1}. **${result.metadata.title || result.metadata.className || 'Untitled'}**\n` +
                      `   Type: ${result.metadata.type}\n` +
                      `   Namespace: ${result.metadata.namespace || 'General'}\n` +
                      `   Content: ${result.content.substring(0, 200)}...\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.tool(
            'search_documentation',
            { query, filters, limit },
            output
          );
          return output;
        } catch (error) {
          logger.error('search_documentation failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 2: Search API Methods
    server.tool(
      'search_api_methods',
      'Find specific API methods and endpoints',
      {
        query: z
          .string()
          .describe('Method name or functionality you are looking for'),
        className: z
          .string()
          .optional()
          .describe('Optional: specific class to search within'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe('Maximum number of results'),
      },
      async ({ query, className, limit }) => {
        logger.tool('search_api_methods', { query, className, limit });

        try {
          await ensureInitialized();
          const results = await apiKnowledgeService.searchApiMethods(
            query,
            className,
            limit
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `Found ${results.length} API methods for "${query}":\n\n${results
                  .map(
                    (result: SearchResult, i: number) =>
                      `${i + 1}. **${result.metadata.methodType || 'Method'}** in ${result.metadata.className || 'Unknown Class'}\n` +
                      `   Content: ${result.content.substring(0, 300)}...\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.tool(
            'search_api_methods',
            { query, className, limit },
            output
          );
          return output;
        } catch (error) {
          logger.error('search_api_methods failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error searching API methods: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 3: Search Classes
    server.tool(
      'search_classes',
      'Find API classes and schemas',
      {
        query: z.string().describe('Class name or type you are looking for'),
        namespace: z
          .string()
          .optional()
          .describe('Optional: specific namespace to search within'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe('Maximum number of results'),
      },
      async ({ query, namespace, limit }) => {
        logger.tool('search_classes', { query, namespace, limit });

        try {
          await ensureInitialized();
          const results = await apiKnowledgeService.searchClasses(
            query,
            namespace,
            limit
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `Found ${results.length} classes for "${query}":\n\n${results
                  .map(
                    (result: SearchResult, i: number) =>
                      `${i + 1}. **${result.metadata.className || result.metadata.title || 'Unknown'}**\n` +
                      `   Namespace: ${result.metadata.namespace || 'General'}\n` +
                      `   Content: ${result.content.substring(0, 200)}...\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.tool('search_classes', { query, namespace, limit }, output);
          return output;
        } catch (error) {
          logger.error('search_classes failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error searching classes: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 4: Discover API
    server.tool(
      'discover_api',
      'Discover PrivMX APIs based on functionality description',
      {
        functionality: z
          .string()
          .describe('Description of the functionality you want to implement'),
        language: z
          .enum(['javascript', 'typescript', 'java', 'swift', 'cpp', 'csharp'])
          .optional()
          .describe('Preferred programming language'),
      },
      async ({ functionality, language }) => {
        logger.tool('discover_api', { functionality, language });

        try {
          await ensureInitialized();
          const results = await apiKnowledgeService.discoverAPI(
            functionality,
            language
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `API recommendations for "${functionality}":\n\n${results
                  .map(
                    (result: SearchResult, i: number) =>
                      `${i + 1}. **${result.metadata.className || result.metadata.title}**\n` +
                      `   Language: ${result.metadata.language || language || 'Any'}\n` +
                      `   Type: ${result.metadata.type}\n` +
                      `   ${result.content.substring(0, 300)}...\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.tool('discover_api', { functionality, language }, output);
          return output;
        } catch (error) {
          logger.error('discover_api failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error discovering API: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 5: Generate Setup Code
    server.tool(
      'generate_setup',
      'Generate PrivMX setup code for specific language and features',
      {
        language: z
          .enum(['javascript', 'typescript', 'java', 'swift', 'cpp', 'csharp'])
          .describe('Programming language'),
        features: z
          .array(z.string())
          .describe('List of features to include in setup'),
      },
      async ({ language, features }) => {
        logger.tool('generate_setup', { language, features });

        try {
          await ensureInitialized();
          const setupCode = apiKnowledgeService.generateSetupCode(
            language,
            features
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `# PrivMX Setup Code (${language})\n\n\`\`\`${language}\n${setupCode}\n\`\`\``,
              },
            ],
          };

          logger.tool('generate_setup', { language, features }, output);
          return output;
        } catch (error) {
          logger.error('generate_setup failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error generating setup code: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 6: Generate Workflow
    server.tool(
      'generate_workflow',
      'Generate complete PrivMX workflow application',
      {
        templateId: z.string().describe('Workflow template ID'),
        language: z
          .enum(['javascript', 'typescript', 'java', 'swift', 'cpp', 'csharp'])
          .describe('Programming language'),
        features: z
          .array(z.string())
          .optional()
          .describe('Optional: specific features to include'),
        customizations: z
          .record(z.any())
          .optional()
          .describe('Optional: custom configuration options'),
      },
      async ({ templateId, language, features, customizations }) => {
        logger.tool('generate_workflow', {
          templateId,
          language,
          features,
          customizations,
        });

        try {
          await ensureInitialized();
          const workflow = await apiKnowledgeService.generateWorkflow(
            templateId,
            language,
            features,
            customizations
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `# Generated PrivMX Workflow: ${templateId}\n\n${JSON.stringify(workflow, null, 2)}`,
              },
            ],
          };

          logger.tool(
            'generate_workflow',
            { templateId, language, features, customizations },
            output
          );
          return output;
        } catch (error) {
          logger.error('generate_workflow failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error generating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    // Tool 7: List Workflow Templates
    server.tool(
      'list_workflow_templates',
      'List all available workflow templates',
      {
        category: z
          .string()
          .optional()
          .describe('Optional: filter by category'),
      },
      async ({ category }) => {
        logger.tool('list_workflow_templates', { category });

        try {
          await ensureInitialized();
          const templates = category
            ? apiKnowledgeService.getWorkflowTemplatesByCategory(category)
            : apiKnowledgeService.getWorkflowTemplates();

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `Available workflow templates${category ? ` (${category})` : ''}:\n\n${templates
                  .map(
                    (template: WorkflowTemplate, i: number) =>
                      `${i + 1}. **${template.id}**\n` +
                      `   Name: ${template.name}\n` +
                      `   Category: ${template.category}\n` +
                      `   Description: ${template.description}\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.tool('list_workflow_templates', { category }, output);
          return output;
        } catch (error) {
          logger.error('list_workflow_templates failed', error);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error listing workflow templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }
    );

    logger.info('PrivMX MCP Server initialized with 7 comprehensive tools');
  },
  {
    capabilities: {
      tools: {
        search_documentation: {
          description: 'Search PrivMX documentation using semantic AI',
        },
        search_api_methods: {
          description: 'Find specific API methods and endpoints',
        },
        search_classes: {
          description: 'Find API classes and schemas',
        },
        discover_api: {
          description:
            'Discover PrivMX APIs based on functionality description',
        },
        generate_setup: {
          description:
            'Generate PrivMX setup code for specific language and features',
        },
        generate_workflow: {
          description: 'Generate complete PrivMX workflow application',
        },
        list_workflow_templates: {
          description: 'List all available workflow templates',
        },
      },
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: true,
    redisUrl: process.env.REDIS_URL,
  }
);

// Custom GET handler to provide endpoint information
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const transport = url.pathname.split('/').pop();

  return Response.json({
    transport,
    status: 'MCP Server Active',
    methods: ['POST', 'DELETE'],
    protocol: 'Model Context Protocol',
    timestamp: new Date().toISOString(),
  });
}

export { handler as POST, handler as DELETE };
