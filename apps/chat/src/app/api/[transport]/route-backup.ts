import { createMcpHandler } from '@vercel/mcp-adapter';
import path from 'path';
import { APISearchService } from '@privmx/mcp-server/services/api/api-search-service';
import { CodeGenerationService } from '@privmx/mcp-server/services/generation/code-generation-service';
import { InteractiveSessionService } from '@privmx/mcp-server/services/workflow/interactive-session-service';
import { KnowledgeService } from '@privmx/mcp-server/services/knowledge/knowledge-service';
import { getTools } from '@privmx/mcp-server/tools';

const logger = {
  info: (message: string, data?: unknown) =>
    console.log(
      `🔍 [MCP INFO] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    ),
  error: (message: string, error?: unknown) => {
    console.error(`❌ [MCP ERROR] ${message}`, error);
    if (error instanceof Error && error.stack)
      console.error('Stack trace:', error.stack);
  },
  tool: (toolName: string, input: unknown) =>
    console.log(
      `🛠️ [MCP TOOL] ${toolName}`,
      `📥 INPUT:`,
      JSON.stringify(input, null, 2)
    ),
  performance: (toolName: string, startTime: number) =>
    console.log(
      `⏱️ [MCP PERF] ${toolName} completed in ${Date.now() - startTime}ms`
    ),
};

const handleToolError = (
  toolName: string,
  error: unknown,
  context?: unknown
) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error(`${toolName} failed`, {
    message: errorMessage,
    context,
    ...(error instanceof Error && { stack: error.stack }),
  });
  return {
    content: [
      {
        type: 'text',
        text: `❌ Error in ${toolName}: ${errorMessage}`,
      },
    ],
  };
};

// Initialize focused services
const searchService = new APISearchService();
const codeGenerationService = new CodeGenerationService();
const sessionService = new InteractiveSessionService();
const knowledgeService = new KnowledgeService();

// Create service container for dependency injection
const serviceContainer = {
  searchService,
  codeGenerationService,
  sessionService,
  knowledgeService,
};

let initPromise: Promise<void> | null = null;
const ensureInitialized = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      logger.info(
        '🚀 Initializing PrivMX MCP Server (Cold Start Optimized)...'
      );
      const startTime = Date.now();

      // Initialize knowledge service (this will handle all the complex initialization)
      const specPath = path.join(process.cwd(), 'spec');

      logger.info(
        '📚 Initializing knowledge service with persistent caching...'
      );

      // Check if vector indexing is enabled
      if (process.env.OPENAI_API_KEY) {
        logger.info(
          '🧠 Vector search enabled - using persistent document index'
        );
      } else {
        logger.info('📝 Vector search disabled - using text-based search only');
      }

      await knowledgeService.initialize(specPath);

      // Other services are initialized by the knowledge service or directly
      logger.info('🏗️ Initializing code generation service...');
      await codeGenerationService.initialize();

      logger.info('🔄 Initializing session service...');
      await sessionService.initialize();

      logger.performance('Service initialization', startTime);
      logger.info('✅ PrivMX MCP Server initialized successfully');

      // Log vector service status
      const vectorServiceStatus = process.env.OPENAI_API_KEY
        ? '🧠 Vector search ready with persistent indexing'
        : '📝 Text-based search only (set OPENAI_API_KEY for vector search)';
      logger.info(vectorServiceStatus);
    } catch (error) {
      logger.error('Failed to initialize PrivMX MCP Server', error);
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
};

const tools = getTools(serviceContainer);
const capabilities = {
  tools: tools.reduce(
    (acc, tool) => {
      acc[tool.name] = { description: tool.description };
      return acc;
    },
    {} as Record<string, { description: string }>
  ),
};

const handler = createMcpHandler(
  async (server) => {
    logger.info(
      `🚀 Initializing PrivMX MCP Server with ${tools.length} Centralized Tools`
    );
    await ensureInitialized();

    tools.forEach((tool) => {
      server.tool(
        tool.name,
        tool.description,
        tool.schema,
        async (args: Record<string, unknown>) => {
          const startTime = Date.now();
          logger.tool(tool.name, args);
          try {
            // Cast args to any to handle the flexible tool parameter types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await tool.handler(args as any);
            logger.performance(tool.name, startTime);
            return result as unknown as {
              [x: string]: unknown;
              content: Array<{
                [x: string]: unknown;
                type: 'text';
                text: string;
              }>;
            };
          } catch (error) {
            return handleToolError(tool.name, error, args) as unknown as {
              [x: string]: unknown;
              content: Array<{
                [x: string]: unknown;
                type: 'text';
                text: string;
              }>;
            };
          }
        }
      );
    });
  },
  {
    capabilities,
  },
  {
    basePath: '/api',
    verboseLogs: true,

    onEvent: (event) => {
      logger.info('MCP Server Event', event);
    },
    redisUrl: process.env.REDIS_URL,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
