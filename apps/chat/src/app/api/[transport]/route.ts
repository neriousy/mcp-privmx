import { createMcpHandler } from '@vercel/mcp-adapter';
import path from 'path';
import { APIKnowledgeService } from '@privmx/mcp-server/services/api-knowledge-service';
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

let initPromise: Promise<void> | null = null;
const ensureInitialized = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      logger.info('Initializing PrivMX MCP Server...');
      const startTime = Date.now();
      await apiKnowledgeService.initialize();
      logger.performance('Service initialization', startTime);
      logger.info('✅ PrivMX MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PrivMX MCP Server', error);
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
};

const tools = getTools(apiKnowledgeService);
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
            // The tool.handler expects destructured arguments, so we pass args directly
            // since our tools are defined with destructuring: ({ query, filters, limit }: any)
            const result = await tool.handler(args);
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
