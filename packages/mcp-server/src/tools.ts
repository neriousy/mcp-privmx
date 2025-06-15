import { z } from 'zod';
// Import our new focused services
import { APISearchService } from './services/api/api-search-service.js';
import { CodeGenerationService } from './services/generation/code-generation-service.js';
import { InteractiveSessionService } from './services/workflow/interactive-session-service.js';
import { KnowledgeService } from './services/knowledge/knowledge-service.js';
import {
  LanguageSchema,
  SkillLevelSchema,
  FrameworkSchema,
  FeatureSchema,
} from './common/schemas.js';
import { SearchResult } from './types/index.js';
import { MCPToolResponse, PrivMXAppRequest } from './types/mcp-types.js';
import type {
  DocumentationResult,
  DocumentationSearchFilters,
} from './types/documentation-types.js';

// Define proper types for tool handlers
interface SearchDocumentationParams {
  query: string;
  filters?: DocumentationSearchFilters;
  limit?: number;
}

interface GetGettingStartedParams {
  language: string;
}

interface GetCodeExamplesParams {
  apiMethod: string;
  language: string;
}

interface GetDocumentsByLanguageParams {
  language: string;
}

interface SearchApiMethodsParams {
  query: string;
  className?: string;
  limit?: number;
}

interface GenerateSetupParams {
  language: string;
  features: string[];
}

type GeneratePrivMXAppParams = PrivMXAppRequest;

type ToolResponse = MCPToolResponse;

/**
 * Service composition interface for dependency injection
 *
 * Updated to include the new KnowledgeService as the main orchestrator
 */
interface ServiceContainer {
  searchService: APISearchService;
  codeGenerationService: CodeGenerationService;
  sessionService: InteractiveSessionService;
  // NEW: Main knowledge orchestration service
  knowledgeService?: KnowledgeService;
}

/**
 * Defines all MCP tools available to AI assistants for PrivMX development
 *
 * Updated to use focused services instead of monolithic APIKnowledgeService
 *
 * @param services - Container with focused service instances
 * @returns Array of MCP tool definitions with schemas and handlers
 */
export const getTools = (services: ServiceContainer) =>
  [
    {
      name: 'search_documentation',
      description:
        '🔍 Search PrivMX documentation using semantic AI with enhanced MDX support',
      schema: {
        query: z
          .string()
          .describe('What you want to find in the PrivMX documentation'),
        filters: z
          .object({
            language: z
              .string()
              .optional()
              .describe('Programming language filter'),
            framework: z.string().optional().describe('Framework filter'),
            skillLevel: z
              .enum(['beginner', 'intermediate', 'advanced'])
              .optional(),
            category: z.string().optional().describe('Document category'),
            namespace: z
              .string()
              .optional()
              .describe('Namespace (Core, Threads, Stores, etc.)'),
            hasCodeExamples: z
              .boolean()
              .optional()
              .describe('Only documents with code examples'),
            tags: z.array(z.string()).optional().describe('Filter by tags'),
          })
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe('Maximum number of results'),
      },
      handler: async (
        params: SearchDocumentationParams
      ): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { query, filters, limit = 5 } = params;
        const results = await services.knowledgeService.searchDocumentation(
          query,
          filters,
          limit
        );

        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} documentation results for "${query}":\n\n${results
                .map(
                  (result: DocumentationResult, i: number) =>
                    `${i + 1}. **${result.title}**\n` +
                    `   Summary: ${result.summary}\n` +
                    `   Language: ${result.metadata.language || 'N/A'}\n` +
                    `   Namespace: ${result.metadata.namespace || 'General'}\n` +
                    `   Code Examples: ${result.codeExamples.length}\n` +
                    `   Key Insights: ${result.aiInsights.keyTakeaways.join(', ')}\n` +
                    `   Content: ${result.content.substring(0, 200)}...\n`
                )
                .join('\n')}`,
            },
          ],
        };
      },
    },
    {
      name: 'get_getting_started_guide',
      description:
        '📚 Get the getting started guide for a specific programming language',
      schema: {
        language: z
          .string()
          .describe('Programming language (js, cpp, java, csharp, etc.)'),
      },
      handler: async (
        params: GetGettingStartedParams
      ): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { language } = params;
        const guide =
          await services.knowledgeService.getGettingStartedGuide(language);

        if (!guide) {
          return {
            content: [
              {
                type: 'text',
                text: `No getting started guide found for ${language}. Try searching with search_documentation instead.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text:
                `# Getting Started with PrivMX (${language})\n\n` +
                `**${guide.title}**\n\n` +
                `${guide.summary}\n\n` +
                `## Key Takeaways\n${guide.aiInsights.keyTakeaways.map((t) => `• ${t}`).join('\n')}\n\n` +
                `## Prerequisites\n${guide.aiInsights.prerequisites.map((p) => `• ${p}`).join('\n')}\n\n` +
                `## Code Examples\n${guide.codeExamples.length} examples available\n\n` +
                `## Content Preview\n${guide.content.substring(0, 500)}...`,
            },
          ],
        };
      },
    },
    {
      name: 'get_code_examples',
      description:
        '💻 Get code examples for specific API methods and programming language',
      schema: {
        apiMethod: z
          .string()
          .describe(
            'API method name (e.g., "createThread", "Endpoint.connect")'
          ),
        language: z.string().describe('Programming language'),
      },
      handler: async (params: GetCodeExamplesParams): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { apiMethod, language } = params;
        const examples = await services.knowledgeService.getCodeExamples(
          apiMethod,
          language
        );

        if (examples.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No code examples found for "${apiMethod}" in ${language}. Try a broader search with search_documentation.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text:
                `# Code Examples for ${apiMethod} (${language})\n\n` +
                `Found ${examples.length} examples:\n\n` +
                examples
                  .map(
                    (example, i) =>
                      `## Example ${i + 1}: ${example.title || 'Code Example'}\n` +
                      `**Complexity:** ${example.complexity}\n` +
                      `**Runnable:** ${example.isRunnable ? 'Yes' : 'No'}\n` +
                      `**Source:** ${example.sourceDocument}\n\n` +
                      `\`\`\`${example.language}\n${example.code}\n\`\`\`\n`
                  )
                  .join('\n'),
            },
          ],
        };
      },
    },
    {
      name: 'get_docs_by_language',
      description:
        '🌐 Get all documentation for a specific programming language',
      schema: {
        language: z
          .string()
          .describe('Programming language (js, cpp, java, csharp, etc.)'),
      },
      handler: async (
        params: GetDocumentsByLanguageParams
      ): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { language } = params;
        const docs =
          await services.knowledgeService.getDocumentsByLanguage(language);

        if (docs.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No documentation found for ${language}. Available languages might include: js, cpp, java, csharp, swift, kotlin.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text:
                `# PrivMX Documentation for ${language}\n\n` +
                `Found ${docs.length} documents:\n\n` +
                docs
                  .slice(0, 10)
                  .map(
                    (doc, i) =>
                      `${i + 1}. **${doc.title}**\n` +
                      `   Category: ${doc.metadata.category}\n` +
                      `   Namespace: ${doc.metadata.namespace}\n` +
                      `   Skill Level: ${doc.metadata.skillLevel || 'N/A'}\n` +
                      `   Code Examples: ${doc.codeExamples.length}\n`
                  )
                  .join('\n') +
                (docs.length > 10
                  ? `\n... and ${docs.length - 10} more documents`
                  : ''),
            },
          ],
        };
      },
    },
    {
      name: 'semantic_documentation_search',
      description:
        '🧠 Advanced semantic search with AI-powered document discovery and insights',
      schema: {
        query: z
          .string()
          .describe(
            'Natural language query describing what you want to learn or find'
          ),
        filters: z
          .object({
            language: z
              .string()
              .optional()
              .describe('Programming language filter'),
            namespace: z
              .string()
              .optional()
              .describe('PrivMX namespace (Threads, Stores, Inboxes, etc.)'),
            skillLevel: z
              .enum(['beginner', 'intermediate', 'advanced'])
              .optional(),
            includeCodeExamples: z
              .boolean()
              .optional()
              .describe('Prioritize results with code examples'),
          })
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(3)
          .describe('Maximum number of results'),
      },
      handler: async (params: {
        query: string;
        filters?: {
          language?: string;
          namespace?: string;
          skillLevel?: 'beginner' | 'intermediate' | 'advanced';
          includeCodeExamples?: boolean;
        };
        limit?: number;
      }): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { query, filters, limit = 3 } = params;

        // Convert filters to documentation search filters
        const docFilters = filters
          ? {
              language: filters.language,
              namespace: filters.namespace,
              skillLevel: filters.skillLevel,
              hasCodeExamples: filters.includeCodeExamples,
            }
          : undefined;

        const results = await services.knowledgeService.searchDocumentation(
          query,
          docFilters,
          limit
        );

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No semantic search results found for "${query}". Try:\n• Using different keywords\n• Broadening your search terms\n• Using the basic search_documentation tool`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text:
                `# 🧠 Semantic Search Results for "${query}"\n\n` +
                `Found ${results.length} highly relevant results using AI-powered semantic matching:\n\n` +
                results
                  .map(
                    (result, i) =>
                      `## ${i + 1}. ${result.title}\n` +
                      `**Language:** ${result.metadata.language || 'General'} | ` +
                      `**Namespace:** ${result.metadata.namespace || 'Core'} | ` +
                      `**Level:** ${result.metadata.skillLevel || 'All levels'}\n\n` +
                      `**Summary:** ${result.summary}\n\n` +
                      `**🎯 Key Insights:**\n${result.aiInsights.keyTakeaways.map((t) => `• ${t}`).join('\n')}\n\n` +
                      `**📚 Prerequisites:**\n${result.aiInsights.prerequisites.map((p) => `• ${p}`).join('\n')}\n\n` +
                      `**💻 Code Examples Available:** ${result.codeExamples.length}\n\n` +
                      `**📖 Content Preview:**\n${result.content.substring(0, 300)}...\n\n` +
                      `**🚀 Next Steps:**\n${result.aiInsights.nextSteps.map((s) => `• ${s}`).join('\n')}\n\n` +
                      `---\n`
                  )
                  .join('\n'),
            },
          ],
        };
      },
    },
    {
      name: 'search_api_methods',
      description: '🔍 Find specific API methods and endpoints',
      schema: {
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
      handler: async (
        params: SearchApiMethodsParams
      ): Promise<ToolResponse> => {
        const { query, className, limit = 10 } = params;
        const results = await services.searchService.searchApiMethods(
          query,
          className,
          limit
        );
        return {
          content: [
            {
              type: 'text',
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
      },
    },
    {
      name: 'generate_setup',
      description:
        '⚙️ Generate PrivMX setup code for specific language and features',
      schema: {
        language: LanguageSchema.describe('Programming language'),
        features: z
          .array(FeatureSchema)
          .describe('List of features to include in setup'),
      },
      handler: async (params: GenerateSetupParams): Promise<ToolResponse> => {
        const { language, features } = params;
        const setupCode = services.codeGenerationService.generateSetupCode(
          language,
          features
        );
        return {
          content: [
            {
              type: 'text',
              text: `# PrivMX Setup Code (${language})\n\n\`\`\`${language}\n${setupCode}\n\`\`\``,
            },
          ],
        };
      },
    },
    {
      name: 'generate_privmx_app',
      description:
        '🏗️ Generate complete PrivMX application using advanced templates',
      schema: {
        templateId: z
          .string()
          .describe('Template ID (e.g., "secure-chat", "file-sharing")'),
        projectName: z.string().describe('Name of the project'),
        framework: FrameworkSchema.describe('Target framework'),
        language: z
          .enum(['javascript', 'typescript'])
          .describe('Programming language'),
        features: z
          .array(FeatureSchema)
          .describe(
            'Features to include (messaging, file-sharing, notifications, auth)'
          ),
        privmxConfig: z
          .object({
            solutionId: z.string().optional().describe('PrivMX Solution ID'),
            platformUrl: z.string().optional().describe('PrivMX Platform URL'),
            apiEndpoints: z
              .array(z.string())
              .describe('API endpoints to include (threads, stores, inboxes)'),
          })
          .describe('PrivMX configuration'),
        userContext: z
          .object({
            skillLevel: SkillLevelSchema.describe(
              "User's programming experience"
            ),
            preferences: z
              .record(z.unknown())
              .optional()
              .describe('Additional preferences'),
          })
          .describe('User context for optimization'),
      },
      handler: async (
        params: GeneratePrivMXAppParams
      ): Promise<ToolResponse> => {
        const result =
          await services.codeGenerationService.generatePrivMXApp(params);
        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Template generation failed:\n${result.errors?.join('\n') || 'Unknown error'}`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text:
                `# 🎉 Generated PrivMX ${params.framework} Application: ${params.projectName}\n\n` +
                `**Template:** ${params.templateId}\n` +
                `**Language:** ${params.language}\n` +
                `**Features:** ${params.features.join(', ')}\n` +
                `**Files Generated:** ${result.data?.files.length || 0}\n\n` +
                `## Generated Files:\n${
                  result.data?.files
                    .map(
                      (file, i) =>
                        `${i + 1}. \`${file.path}\` (${file.content.length} chars)`
                    )
                    .join('\n') || 'No files generated'
                }\n\n` +
                `## Next Steps:\n` +
                `1. Install dependencies: \`npm install\` or \`pnpm install\`\n` +
                `2. Configure PrivMX credentials in your environment\n` +
                `3. Run the development server\n` +
                `4. Customize the generated components to match your requirements`,
            },
          ],
        };
      },
    },
    {
      name: 'list_privmx_templates',
      description: '📋 List all available PrivMX application templates',
      schema: {},
      handler: async (): Promise<ToolResponse> => {
        const templates =
          await services.codeGenerationService.getAvailablePrivMXTemplates();
        return {
          content: [
            {
              type: 'text',
              text: `# 📋 Available PrivMX Templates\n\n${templates
                .map(
                  (template, i: number) =>
                    `## ${i + 1}. ${template.name}\n` +
                    `**ID:** \`${template.id}\`\n` +
                    `**Description:** ${template.description}\n` +
                    `**Frameworks:** ${template.frameworks.join(', ')}\n` +
                    `**Features:** ${template.features.join(', ')}\n`
                )
                .join('\n')}`,
            },
          ],
        };
      },
    },
    {
      name: 'force_reindex_documentation',
      description:
        '🔄 Force a complete re-indexing of all documentation embeddings (expensive operation)',
      schema: {
        reason: z
          .string()
          .optional()
          .describe('Reason for forcing re-indexing (optional)'),
      },
      handler: async (params: { reason?: string }): Promise<ToolResponse> => {
        if (!services.knowledgeService) {
          throw new Error('KnowledgeService not available');
        }

        const { reason } = params;

        console.log(
          `🔄 Force re-indexing documentation${reason ? ` - Reason: ${reason}` : ''}`
        );

        try {
          // Access the documentation service through knowledge service
          const docService = (services.knowledgeService as any)
            .documentationService;

          if (!docService) {
            throw new Error('DocumentationIndexService not available');
          }

          // Force re-index with the flag
          const result = await docService.indexDocuments('spec/mdx', true);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'success',
                    message: 'Documentation re-indexing completed',
                    reason: reason || 'Manual refresh requested',
                    timestamp: new Date().toISOString(),
                    documentsIndexed: result.documentsIndexed,
                    codeExamplesExtracted: result.codeExamplesExtracted,
                    indexingTime: result.indexingTime,
                    warnings:
                      result.errors.length > 0 ? result.errors : undefined,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Re-indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      },
    },
    {
      name: 'set_hybrid_search_weights',
      description:
        '⚖️ Adjust TEXT_WEIGHT and VECTOR_WEIGHT for hybrid search at runtime',
      schema: {
        textWeight: z
          .number()
          .min(0)
          .max(1)
          .describe('Weight for lexical text search (0-1)'),
        vectorWeight: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            'Weight for semantic vector search (defaults to 1 - textWeight)'
          ),
      },
      handler: async (params: {
        textWeight: number;
        vectorWeight?: number;
      }): Promise<ToolResponse> => {
        const { textWeight, vectorWeight } = params;
        const vec =
          typeof vectorWeight === 'number'
            ? vectorWeight
            : Math.max(0, 1 - textWeight);

        // Update in-process env so subsequent searches pick them up
        process.env.TEXT_WEIGHT = textWeight.toString();
        process.env.VECTOR_WEIGHT = vec.toString();

        return {
          content: [
            {
              type: 'text',
              text: `Hybrid search weights updated:\n• TEXT_WEIGHT = ${process.env.TEXT_WEIGHT}\n• VECTOR_WEIGHT = ${process.env.VECTOR_WEIGHT}`,
            },
          ],
        };
      },
    },
    {
      name: 'set_api_hybrid_weights',
      description:
        '⚖️ Adjust API_TEXT_WEIGHT and API_VECTOR_WEIGHT for API hybrid search',
      schema: {
        textWeight: z
          .number()
          .min(0)
          .max(1)
          .describe('Weight for lexical API search (0-1)'),
        vectorWeight: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe('Weight for semantic API search'),
      },
      handler: async (params: {
        textWeight: number;
        vectorWeight?: number;
      }): Promise<ToolResponse> => {
        const vec =
          typeof params.vectorWeight === 'number'
            ? params.vectorWeight
            : Math.max(0, 1 - params.textWeight);
        process.env.API_TEXT_WEIGHT = params.textWeight.toString();
        process.env.API_VECTOR_WEIGHT = vec.toString();
        return {
          content: [
            {
              type: 'text',
              text: `API hybrid search weights updated:\n• API_TEXT_WEIGHT = ${process.env.API_TEXT_WEIGHT}\n• API_VECTOR_WEIGHT = ${process.env.API_VECTOR_WEIGHT}`,
            },
          ],
        };
      },
    },
  ] as const;

/**
 * Legacy compatibility function for backward compatibility
 * This allows existing code to continue working while migrating to focused services
 */
export const getToolsLegacy = (apiKnowledgeService: any) => {
  // This is a temporary bridge function that will need proper service composition
  // For now, we'll throw an error indicating migration is needed
  throw new Error(
    'Legacy APIKnowledgeService usage detected. Please update to use focused services. ' +
      'Use getTools() with ServiceContainer instead of getToolsLegacy().'
  );
};
