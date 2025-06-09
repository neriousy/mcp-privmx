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

// Enhanced logger with better formatting and error tracking
const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `🔍 [MCP INFO] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  error: (message: string, error?: any) => {
    console.error(`❌ [MCP ERROR] ${message}`, error);
    // Log stack trace for debugging
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `🐛 [MCP DEBUG] ${message}`,
        data ? JSON.stringify(data, null, 2) : ''
      );
    }
  },
  tool: (toolName: string, input: any, output?: any) => {
    console.log(`🛠️  [MCP TOOL] ${toolName}`);
    console.log(`📥 INPUT:`, JSON.stringify(input, null, 2));
    if (output) {
      // Truncate large outputs for readability
      const truncatedOutput = JSON.stringify(output, null, 2);
      if (truncatedOutput.length > 2000) {
        console.log(`📤 OUTPUT: ${truncatedOutput.substring(0, 2000)}...`);
      } else {
        console.log(`📤 OUTPUT:`, truncatedOutput);
      }
    }
  },
  performance: (toolName: string, startTime: number) => {
    const duration = Date.now() - startTime;
    console.log(`⏱️  [MCP PERF] ${toolName} completed in ${duration}ms`);
  },
};

// Enhanced error handler with specific error types
const handleToolError = (toolName: string, error: unknown, context?: any) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorType =
    error instanceof Error ? error.constructor.name : 'UnknownError';

  logger.error(`${toolName} failed [${errorType}]`, {
    message: errorMessage,
    context,
    ...(error instanceof Error && { stack: error.stack }),
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: `❌ Error in ${toolName}: ${errorMessage}${
          process.env.NODE_ENV === 'development'
            ? `\n\nError Type: ${errorType}`
            : ''
        }`,
      },
    ],
  };
};

// Common validation schemas
const LanguageSchema = z.enum([
  'javascript',
  'typescript',
  'java',
  'swift',
  'cpp',
  'csharp',
]);
const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
const FrameworkSchema = z.enum(['react', 'vue', 'vanilla', 'nodejs']);

// Initialize the API Knowledge Service with enhanced configuration
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

// Singleton initialization with better error handling
let initPromise: Promise<void> | null = null;
let isInitialized = false;

const ensureInitialized = async () => {
  if (isInitialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        logger.info('Initializing PrivMX MCP Server...');
        const startTime = Date.now();
        await apiKnowledgeService.initialize();
        isInitialized = true;
        logger.performance('Service initialization', startTime);
        logger.info('✅ PrivMX MCP Server initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize PrivMX MCP Server', error);
        initPromise = null; // Reset to allow retry
        throw error;
      }
    })();
  }

  await initPromise;
};

const handler = createMcpHandler(
  async (server) => {
    logger.info(
      '🚀 Initializing PrivMX MCP Server with Phase 3 Integration Tools'
    );

    // ========================================
    // CATEGORY 1: DOCUMENTATION & SEARCH TOOLS
    // ========================================

    server.tool(
      'search_documentation',
      '🔍 Search PrivMX documentation using semantic AI',
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
        const startTime = Date.now();
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

          logger.performance('search_documentation', startTime);
          return output;
        } catch (error) {
          return handleToolError('search_documentation', error, {
            query,
            filters,
            limit,
          });
        }
      }
    );

    server.tool(
      'enhanced_search',
      '🧠 Advanced context-aware search with intelligent results',
      {
        query: z.string().describe('What you want to find or implement'),
        language: LanguageSchema.optional().describe(
          'Preferred programming language'
        ),
        framework: z
          .string()
          .optional()
          .describe('Target framework (React, Vue, etc.)'),
        skill_level: SkillLevelSchema.optional().describe(
          "User's experience level"
        ),
        current_code: z
          .string()
          .optional()
          .describe("User's existing code for context"),
      },
      async ({ query, language, framework, skill_level, current_code }) => {
        const startTime = Date.now();
        logger.tool('enhanced_search', {
          query,
          language,
          framework,
          skill_level,
        });

        try {
          await ensureInitialized();

          const context = {
            userContext: {
              language: language || 'javascript',
              targetFramework: framework,
              userSkillLevel: skill_level,
            },
            currentCode: current_code,
            userSkillLevel: skill_level,
          };

          const results = await apiKnowledgeService.searchWithContext(
            query,
            context
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `# 🧠 Enhanced Search Results for "${query}"\n\n${results
                  .map(
                    (result, i: number) =>
                      `## ${i + 1}. ${result.metadata.title || result.metadata.className || 'Result'}\n` +
                      `**Type:** ${result.metadata.type} | **Language:** ${result.metadata.language}\n` +
                      `**Context Score:** ${result.contextScore}/5 | **Completeness:** ${Math.round(result.completeness * 100)}%\n\n` +
                      `**Content:** ${result.content.substring(0, 300)}...\n\n` +
                      (result.prerequisites.length
                        ? `**Prerequisites:** ${result.prerequisites.join(', ')}\n\n`
                        : '') +
                      (result.relatedMethods.length
                        ? `**Related Methods:** ${result.relatedMethods.join(', ')}\n\n`
                        : '') +
                      (result.errorPatterns.length
                        ? `**Common Errors:** ${result.errorPatterns.map((e: any) => e.errorType).join(', ')}\n\n`
                        : '')
                  )
                  .join('---\n\n')}`,
              },
            ],
          };

          logger.performance('enhanced_search', startTime);
          return output;
        } catch (error) {
          return handleToolError('enhanced_search', error, {
            query,
            language,
            framework,
            skill_level,
          });
        }
      }
    );

    // ========================================
    // CATEGORY 2: PHASE 3 TEMPLATE GENERATION (PLOP.JS)
    // ========================================

    server.tool(
      'generate_privmx_app',
      '🏗️ Generate complete PrivMX application using advanced templates',
      {
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
              .record(z.any())
              .optional()
              .describe('Additional preferences'),
          })
          .describe('User context for optimization'),
      },
      async ({
        templateId,
        projectName,
        framework,
        language,
        features,
        privmxConfig,
        userContext,
      }) => {
        const startTime = Date.now();
        logger.tool('generate_privmx_app', {
          templateId,
          projectName,
          framework,
          language,
          features,
        });

        try {
          await ensureInitialized();
          const result = await apiKnowledgeService.generatePrivMXApp({
            templateId,
            projectName,
            framework,
            language,
            features,
            privmxConfig,
            userContext,
          });

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Template generation failed:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# 🎉 Generated PrivMX ${framework} Application: ${projectName}\n\n` +
                  `**Template:** ${templateId}\n` +
                  `**Language:** ${language}\n` +
                  `**Features:** ${features.join(', ')}\n` +
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

          logger.performance('generate_privmx_app', startTime);
          return output;
        } catch (error) {
          return handleToolError('generate_privmx_app', error, {
            templateId,
            projectName,
            framework,
          });
        }
      }
    );

    server.tool(
      'list_privmx_templates',
      '📋 List all available PrivMX application templates',
      {},
      async () => {
        const startTime = Date.now();
        logger.tool('list_privmx_templates', {});

        try {
          await ensureInitialized();
          const templates =
            await apiKnowledgeService.getAvailablePrivMXTemplates();

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `# 📋 Available PrivMX Templates\n\n${templates
                  .map(
                    (template, i) =>
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

          logger.performance('list_privmx_templates', startTime);
          return output;
        } catch (error) {
          return handleToolError('list_privmx_templates', error);
        }
      }
    );

    // ========================================
    // CATEGORY 3: CODE TRANSFORMATION (JSCODESHIFT)
    // ========================================

    server.tool(
      'transform_code_with_privmx',
      '🔄 Transform existing code with PrivMX integration using AST manipulation',
      {
        sourceCode: z.string().describe('The source code to transform'),
        transformation: z
          .enum([
            'add-privmx-integration',
            'upgrade-sdk',
            'add-security-patterns',
          ])
          .describe('Type of transformation to apply'),
        targetFramework: z
          .string()
          .optional()
          .describe('Target framework for optimization'),
        options: z
          .record(z.any())
          .optional()
          .describe('Additional transformation options'),
      },
      async ({ sourceCode, transformation, targetFramework, options }) => {
        const startTime = Date.now();
        logger.tool('transform_code_with_privmx', {
          transformation,
          targetFramework,
          codeLength: sourceCode.length,
        });

        try {
          await ensureInitialized();
          const result = await apiKnowledgeService.transformCodeWithPrivMX({
            sourceCode,
            transformation,
            targetFramework,
            options,
          });

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Code transformation failed:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# 🔄 Code Transformation Complete\n\n` +
                  `**Transformation:** ${transformation}\n` +
                  `**Framework:** ${targetFramework || 'Generic'}\n\n` +
                  `## Transformed Code:\n\`\`\`${targetFramework === 'react' ? 'jsx' : 'javascript'}\n${result.data?.transformedCode || 'No transformation applied'}\n\`\`\``,
              },
            ],
          };

          logger.performance('transform_code_with_privmx', startTime);
          return output;
        } catch (error) {
          return handleToolError('transform_code_with_privmx', error, {
            transformation,
            targetFramework,
          });
        }
      }
    );

    server.tool(
      'list_code_transformations',
      '⚙️ List all available code transformations',
      {},
      async () => {
        const startTime = Date.now();
        logger.tool('list_code_transformations', {});

        try {
          await ensureInitialized();
          const transformations =
            apiKnowledgeService.getAvailableCodeTransformations();

          const output = {
            content: [
              {
                type: 'text' as const,
                text: `# ⚙️ Available Code Transformations\n\n${transformations
                  .map(
                    (transform, i) =>
                      `## ${i + 1}. ${transform.name}\n` +
                      `**ID:** \`${transform.id}\`\n` +
                      `**Description:** ${transform.description}\n` +
                      `**Frameworks:** ${transform.frameworks.join(', ')}\n`
                  )
                  .join('\n')}`,
              },
            ],
          };

          logger.performance('list_code_transformations', startTime);
          return output;
        } catch (error) {
          return handleToolError('list_code_transformations', error);
        }
      }
    );

    // ========================================
    // CATEGORY 4: INTERACTIVE WORKFLOWS (INQUIRER.JS)
    // ========================================

    server.tool(
      'start_interactive_workflow',
      '🚀 Start an interactive PrivMX development workflow',
      {
        goal: z.string().describe('What you want to build or achieve'),
        userContext: z
          .object({
            skillLevel: SkillLevelSchema.describe(
              "User's programming experience"
            ),
            preferredFramework: z
              .string()
              .optional()
              .describe('Preferred framework'),
            projectType: z
              .enum(['prototype', 'production', 'learning'])
              .optional()
              .describe('Type of project'),
          })
          .describe('User context for workflow customization'),
      },
      async ({ goal, userContext }) => {
        const startTime = Date.now();
        logger.tool('start_interactive_workflow', { goal, userContext });

        try {
          await ensureInitialized();
          const result =
            await apiKnowledgeService.startInteractivePrivMXWorkflow({
              goal,
              userContext,
            });

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Failed to start interactive workflow:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# 🚀 Interactive Workflow Started\n\n` +
                  `**Goal:** ${goal}\n` +
                  `**Session ID:** \`${result.data?.sessionId}\`\n` +
                  `**Skill Level:** ${userContext.skillLevel}\n\n` +
                  `## First Step:\n${JSON.stringify(result.data?.firstStep, null, 2)}\n\n` +
                  `💡 Use the \`continue_interactive_workflow\` tool with your session ID to proceed.`,
              },
            ],
          };

          logger.performance('start_interactive_workflow', startTime);
          return output;
        } catch (error) {
          return handleToolError('start_interactive_workflow', error, {
            goal,
            userContext,
          });
        }
      }
    );

    server.tool(
      'continue_interactive_workflow',
      '➡️ Continue an interactive workflow session',
      {
        sessionId: z.string().describe('The workflow session ID'),
        answers: z.record(z.any()).describe('Your answers to the current step'),
      },
      async ({ sessionId, answers }) => {
        const startTime = Date.now();
        logger.tool('continue_interactive_workflow', { sessionId, answers });

        try {
          await ensureInitialized();
          const result = await apiKnowledgeService.continuePrivMXWorkflow(
            sessionId,
            answers
          );

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Failed to continue workflow:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const isComplete = result.data?.isComplete;
          const nextStep = result.data?.nextStep;
          const generatedFiles = result.data?.generatedFiles;

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# ➡️ Workflow Progress Update\n\n` +
                  `**Session ID:** \`${sessionId}\`\n` +
                  `**Status:** ${isComplete ? '✅ Complete!' : '🔄 In Progress'}\n\n` +
                  (nextStep
                    ? `## Next Step:\n${JSON.stringify(nextStep, null, 2)}\n\n`
                    : '') +
                  (generatedFiles?.length
                    ? `## Generated Files:\n${generatedFiles.map((file, i) => `${i + 1}. ${file}`).join('\n')}\n\n`
                    : '') +
                  (isComplete
                    ? `🎉 **Workflow Complete!** Your PrivMX application has been generated.`
                    : `💡 Continue with the \`continue_interactive_workflow\` tool to proceed.`),
              },
            ],
          };

          logger.performance('continue_interactive_workflow', startTime);
          return output;
        } catch (error) {
          return handleToolError('continue_interactive_workflow', error, {
            sessionId,
          });
        }
      }
    );

    // ========================================
    // CATEGORY 5: PRIVMX INTELLIGENCE
    // ========================================

    server.tool(
      'get_privmx_intelligence',
      '🧠 Get AI-powered insights about PrivMX APIs and patterns',
      {
        query: z.string().describe('Your question or code to analyze'),
        type: z
          .enum([
            'api-relationship',
            'workflow-suggestion',
            'pattern-validation',
            'optimization',
          ])
          .describe('Type of intelligence needed'),
        context: z
          .object({
            apis: z.array(z.string()).optional().describe('APIs being used'),
            framework: z.string().optional().describe('Target framework'),
            codeSnippet: z
              .string()
              .optional()
              .describe('Code snippet for analysis'),
          })
          .optional()
          .describe('Additional context for better insights'),
      },
      async ({ query, type, context }) => {
        const startTime = Date.now();
        logger.tool('get_privmx_intelligence', { query, type, context });

        try {
          await ensureInitialized();
          const result = await apiKnowledgeService.getPrivMXIntelligence({
            query,
            type,
            context,
          });

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Intelligence request failed:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# 🧠 PrivMX Intelligence Insights\n\n` +
                  `**Query:** ${query}\n` +
                  `**Analysis Type:** ${type}\n` +
                  `**Framework:** ${context?.framework || 'Generic'}\n\n` +
                  `## Results:\n${JSON.stringify(result.data, null, 2)}`,
              },
            ],
          };

          logger.performance('get_privmx_intelligence', startTime);
          return output;
        } catch (error) {
          return handleToolError('get_privmx_intelligence', error, {
            query,
            type,
          });
        }
      }
    );

    server.tool(
      'validate_privmx_code',
      '✅ Validate PrivMX code patterns and best practices',
      {
        code: z.string().describe('Code to validate'),
        context: z
          .object({
            framework: z.string().optional().describe('Target framework'),
            apis: z.array(z.string()).optional().describe('APIs being used'),
          })
          .optional()
          .describe('Validation context'),
      },
      async ({ code, context }) => {
        const startTime = Date.now();
        logger.tool('validate_privmx_code', {
          codeLength: code.length,
          context,
        });

        try {
          await ensureInitialized();
          const result = await apiKnowledgeService.validatePrivMXCode(
            code,
            context
          );

          if (!result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `❌ Code validation failed:\n${result.errors?.join('\n') || 'Unknown error'}`,
                },
              ],
            };
          }

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# ✅ Code Validation Results\n\n` +
                  `**Framework:** ${context?.framework || 'Generic'}\n` +
                  `**APIs:** ${context?.apis?.join(', ') || 'Auto-detected'}\n\n` +
                  `## Validation Report:\n${JSON.stringify(result.data, null, 2)}`,
              },
            ],
          };

          logger.performance('validate_privmx_code', startTime);
          return output;
        } catch (error) {
          return handleToolError('validate_privmx_code', error, { context });
        }
      }
    );

    // ========================================
    // CATEGORY 6: LEGACY TOOLS (MAINTAINED FOR COMPATIBILITY)
    // ========================================

    server.tool(
      'search_api_methods',
      '🔍 Find specific API methods and endpoints',
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
        const startTime = Date.now();
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

          logger.performance('search_api_methods', startTime);
          return output;
        } catch (error) {
          return handleToolError('search_api_methods', error, {
            query,
            className,
            limit,
          });
        }
      }
    );

    server.tool(
      'generate_setup',
      '⚙️ Generate PrivMX setup code for specific language and features',
      {
        language: LanguageSchema.describe('Programming language'),
        features: z
          .array(z.string())
          .describe('List of features to include in setup'),
      },
      async ({ language, features }) => {
        const startTime = Date.now();
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

          logger.performance('generate_setup', startTime);
          return output;
        } catch (error) {
          return handleToolError('generate_setup', error, {
            language,
            features,
          });
        }
      }
    );

    server.tool(
      'build_complete_app',
      '🏗️ Generate a complete, working PrivMX application (legacy)',
      {
        requirements: z
          .string()
          .describe('Natural language description of what to build'),
        language: LanguageSchema.describe('Programming language'),
        framework: z
          .string()
          .optional()
          .describe('Target framework (React, Vue, Node.js, etc.)'),
        skill_level: z
          .enum(['beginner', 'intermediate', 'expert'])
          .optional()
          .default('intermediate')
          .describe("User's programming experience level"),
        project_type: z
          .enum(['web', 'mobile', 'desktop', 'server'])
          .optional()
          .default('web')
          .describe('Type of project being built'),
      },
      async ({
        requirements,
        language,
        framework,
        skill_level,
        project_type,
      }) => {
        const startTime = Date.now();
        logger.tool('build_complete_app', {
          requirements,
          language,
          framework,
          skill_level,
          project_type,
        });

        try {
          await ensureInitialized();

          const context = {
            language,
            targetFramework: framework,
            userSkillLevel: skill_level,
            projectType: project_type,
            includeErrorHandling: true,
            includeComments: skill_level === 'beginner',
          };

          const result = await apiKnowledgeService.generateCompleteCode(
            requirements,
            context
          );

          const output = {
            content: [
              {
                type: 'text' as const,
                text:
                  `# Complete ${language} Application: ${requirements}\n\n` +
                  `## Generated Code\n\n\`\`\`${language}\n${result.code}\n\`\`\`\n\n` +
                  `## Required Dependencies\n${result.dependencies.map((dep: string) => `- ${dep}`).join('\n')}\n\n` +
                  `## Required Imports\n${result.imports.map((imp: string) => `- ${imp}`).join('\n')}\n\n` +
                  `## Explanation\n${result.explanation}\n\n` +
                  (result.warnings?.length
                    ? `## Warnings\n${result.warnings.map((w: string) => `- ⚠️ ${w}`).join('\n')}\n\n`
                    : '') +
                  (result.nextSteps?.length
                    ? `## Next Steps\n${result.nextSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`
                    : ''),
              },
            ],
          };

          logger.performance('build_complete_app', startTime);
          return output;
        } catch (error) {
          return handleToolError('build_complete_app', error, {
            requirements,
            language,
            framework,
          });
        }
      }
    );

    logger.info(
      '✅ PrivMX MCP Server initialized with 12 tools (8 Phase 3 + 4 legacy)'
    );
    logger.info(
      '🎯 Phase 3 Tools: Template Generation, Code Transformation, Interactive Workflows, AI Intelligence'
    );
  },
  {
    capabilities: {
      tools: {
        // Phase 3 Tools
        generate_privmx_app: {
          description:
            '🏗️ Generate complete PrivMX applications using advanced templates',
        },
        list_privmx_templates: {
          description: '📋 List all available PrivMX templates',
        },
        transform_code_with_privmx: {
          description:
            '🔄 Transform code with PrivMX integration using AST manipulation',
        },
        list_code_transformations: {
          description: '⚙️ List available code transformations',
        },
        start_interactive_workflow: {
          description: '🚀 Start interactive development workflows',
        },
        continue_interactive_workflow: {
          description: '➡️ Continue interactive workflow sessions',
        },
        get_privmx_intelligence: {
          description: '🧠 Get AI-powered PrivMX insights',
        },
        validate_privmx_code: {
          description: '✅ Validate PrivMX code patterns',
        },

        // Enhanced Tools
        search_documentation: {
          description: '🔍 Search PrivMX documentation with semantic AI',
        },
        enhanced_search: { description: '🧠 Advanced context-aware search' },

        // Legacy Tools (maintained for compatibility)
        search_api_methods: { description: '🔍 Find specific API methods' },
        generate_setup: { description: '⚙️ Generate setup code' },
        build_complete_app: {
          description: '🏗️ Generate complete applications (legacy)',
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

// Enhanced GET handler with more information
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const transport = url.pathname.split('/').pop();

  return Response.json({
    service: 'PrivMX MCP Server',
    transport,
    status: 'Active',
    version: 'Phase 3 - Integration Layer',
    methods: ['POST', 'DELETE'],
    protocol: 'Model Context Protocol',
    timestamp: new Date().toISOString(),
    capabilities: {
      total_tools: 12,
      categories: {
        template_generation: ['generate_privmx_app', 'list_privmx_templates'],
        code_transformation: [
          'transform_code_with_privmx',
          'list_code_transformations',
        ],
        interactive_workflows: [
          'start_interactive_workflow',
          'continue_interactive_workflow',
        ],
        ai_intelligence: ['get_privmx_intelligence', 'validate_privmx_code'],
        search_discovery: ['search_documentation', 'enhanced_search'],
        legacy_tools: [
          'search_api_methods',
          'generate_setup',
          'build_complete_app',
        ],
      },
    },
    phase_3_features: {
      plop_templates: 'Advanced template generation with Handlebars',
      jscodeshift_transforms: 'AST-based code transformation',
      inquirer_workflows: 'Interactive development workflows',
      privmx_intelligence: 'AI-powered PrivMX insights',
      web_compatibility: 'Webpack-compatible template engine',
    },
  });
}

export { handler as POST, handler as DELETE };
