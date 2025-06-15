import { createMcpHandler } from '@vercel/mcp-adapter';
import { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { MCPController } from '@/features/mcp/mcp-controller';

/**
 * Refactored MCP Route Handler
 *
 * Key improvements:
 * - Uses singleton ServiceManager to prevent service recreation
 * - Extracts business logic to MCPController
 * - Eliminates embeddings recreation on cold starts
 * - Implements proper error handling and logging
 * - Optimizes performance through caching
 * - Pre-defines capabilities (MCP adapter doesn't support dynamic capabilities)
 * - Fixed race conditions and initialization timing issues
 */

let mcpController: MCPController | null = null;
// Shared promise ensures initialization happens only once per module instance
const initializationPromise: Promise<MCPController> = (async () => {
  mcpController = mcpController ?? new MCPController();
  await mcpController.initialize();
  return mcpController;
})();

/**
 * Get or create the MCP controller singleton with proper initialization
 */
async function getMCPController(): Promise<MCPController> {
  if (mcpController?.isReady()) return mcpController;
  return initializationPromise;
}

/**
 * Enhanced logger with performance tracking
 */
const logger = {
  info: (message: string, data?: unknown) =>
    console.log(
      `🔍 [MCP REFACTORED] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    ),
  error: (message: string, error?: unknown) => {
    console.error(`❌ [MCP REFACTORED] ${message}`, error);
    if (error instanceof Error && error.stack)
      console.error('Stack trace:', error.stack);
  },
  performance: (operation: string, startTime: number) =>
    console.log(
      `⏱️ [MCP REFACTORED] ${operation} completed in ${Date.now() - startTime}ms`
    ),
};

/**
 * Pre-defined server capabilities
 * Note: MCP adapter requires static capabilities at creation time
 */
const serverCapabilities: ServerCapabilities = {
  tools: {
    listChanged: true, // Indicates tools can be dynamically loaded
  },
  completions: {
    supports: {
      model: 'gpt-4o-mini',
    },
  },
  // Add other capabilities that our services provide
  prompts: {
    listChanged: false,
  },
  resources: {
    subscribe: false,
    listChanged: false,
  },
};

/**
 * Main MCP handler with improved singleton architecture
 */
const handler = createMcpHandler(
  async (server) => {
    try {
      logger.info('🔌 MCP Server handler starting...');

      // Get properly initialized controller (handles race conditions)
      const controller = await getMCPController();
      const tools = await controller.getTools();

      logger.info(`🎯 Registering ${tools.length} tools with MCP server`);

      // Register tool handlers
      tools.forEach((tool) => {
        server.tool(
          tool.name,
          tool.description,
          tool.schema,
          async (args: Record<string, unknown>) => {
            try {
              // Use controller for tool execution (includes proper error handling)
              const result = await controller.executeTool(tool.name, args);

              return result as {
                [x: string]: unknown;
                content: Array<{
                  [x: string]: unknown;
                  type: 'text';
                  text: string;
                }>;
              };
            } catch (error) {
              logger.error(`Tool execution error: ${tool.name}`, error);

              // Return formatted error response
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `❌ Error executing ${tool.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
              };
            }
          }
        );
      });

      // Log initialization stats
      const serviceStats = await controller.getServiceStats();
      logger.info('📊 Service stats:', serviceStats.serviceManager);
      logger.info('✅ MCP Server handler ready');
    } catch (error) {
      logger.error('Failed to initialize MCP Server handler', error);
      throw error;
    }
  },
  {
    // Static capabilities - MCP adapter doesn't support dynamic capabilities
    capabilities: serverCapabilities,
  },
  {
    basePath: '/api/privmx',
    verboseLogs: true,
    onEvent: (event) => {
      logger.info('MCP Server Event', event);
    },
    redisUrl: process.env.REDIS_URL,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
