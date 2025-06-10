import { z } from 'zod';
import { APIKnowledgeService } from './services/api-knowledge-service.js';
import {
  LanguageSchema,
  SkillLevelSchema,
  FrameworkSchema,
} from './common/schemas.js';
import { SearchResult } from './services/types.js';
import { ConfigObject } from './common/types.js';

// Define proper types for tool handlers
interface SearchDocumentationParams {
  query: string;
  filters?: {
    type?: 'json-api' | 'mdx' | 'markdown';
    namespace?: string;
  };
  limit?: number;
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

interface GeneratePrivMXAppParams {
  templateId: string;
  projectName: string;
  framework: 'react' | 'vue' | 'vanilla' | 'nodejs';
  language: 'javascript' | 'typescript';
  features: string[];
  privmxConfig: {
    solutionId?: string;
    platformUrl?: string;
    apiEndpoints: string[];
  };
  userContext: {
    skillLevel: 'beginner' | 'intermediate' | 'expert';
    preferences?: ConfigObject;
  };
}

interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
    [key: string]: unknown;
  }>;
}

// This function defines all the tools and will be used by both the standalone server
// and the Vercel adapter to avoid duplication.
export const getTools = (apiKnowledgeService: APIKnowledgeService) =>
  [
    {
      name: 'search_documentation',
      description: '🔍 Search PrivMX documentation using semantic AI',
      schema: {
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
      handler: async (
        params: SearchDocumentationParams
      ): Promise<ToolResponse> => {
        const { query, filters, limit = 5 } = params;
        const results = await apiKnowledgeService.searchDocumentation(
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
        const results = await apiKnowledgeService.searchApiMethods(
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
          .array(z.string())
          .describe('List of features to include in setup'),
      },
      handler: async (params: GenerateSetupParams): Promise<ToolResponse> => {
        const { language, features } = params;
        const setupCode = apiKnowledgeService.generateSetupCode(
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
          .array(z.string())
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
        const result = await apiKnowledgeService.generatePrivMXApp(params);
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
          await apiKnowledgeService.getAvailablePrivMXTemplates();
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
    // Add other tools here...
  ] as const;
