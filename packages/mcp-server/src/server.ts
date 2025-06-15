#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { APISearchService } from './services/api/api-search-service.js';
import { CodeGenerationService } from './services/generation/code-generation-service.js';
import { InteractiveSessionService } from './services/workflow/interactive-session-service.js';
import { KnowledgeService } from './services/knowledge/knowledge-service.js';
import { config } from './common/config.js';
import { specRoot } from './common/paths.js';
import logger from './common/logger.js';
import { getTools } from './tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { MCPServerCapabilities } from './types/mcp-types.js';
import { startSpan } from './common/otel.js';
import { initMetricsServer } from './common/metrics.js';

/**
 * PrivMX MCP Server
 *
 * Provides AI assistants with tools for PrivMX API discovery,
 * documentation search, and code generation capabilities.
 *
 * Updated to use focused services for better maintainability.
 */

type ServerCapabilities = MCPServerCapabilities;

/**
 * Main MCP server class for PrivMX development assistance
 * Now using focused services instead of monolithic APIKnowledgeService
 */
class PrivMXMCPServer {
  private server: Server;
  private searchService: APISearchService;
  private codeGenerationService: CodeGenerationService;
  private sessionService: InteractiveSessionService;
  private knowledgeService: KnowledgeService;
  private initialized = false;
  private tools: ReturnType<typeof getTools>;
  private toolMap: Map<string, ReturnType<typeof getTools>[number]>;

  constructor() {
    // Initialize focused services
    this.searchService = new APISearchService();
    this.codeGenerationService = new CodeGenerationService();
    this.sessionService = new InteractiveSessionService();
    this.knowledgeService = new KnowledgeService();

    // Create service container for dependency injection
    const serviceContainer = {
      searchService: this.searchService,
      codeGenerationService: this.codeGenerationService,
      sessionService: this.sessionService,
      knowledgeService: this.knowledgeService, // Added missing knowledgeService
    };

    this.tools = getTools(serviceContainer);
    this.toolMap = new Map(this.tools.map((t) => [t.name, t]));

    const capabilities: ServerCapabilities = {
      tools: this.tools.reduce(
        (acc, tool) => {
          acc[tool.name] = { description: tool.description };
          return acc;
        },
        {} as Record<string, { description: string }>
      ),
    };

    this.server = new Server(
      {
        name: 'privmx-mcp-server',
        version: '1.0.0',
      },
      { capabilities }
    );

    this.setupHandlers();

    // Start metrics endpoint early
    initMetricsServer();
  }

  /**
   * Ensures all services are initialized before processing requests
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    logger.info('🏗️ Initializing PrivMX services...');

    try {
      // Build knowledge graph first
      const specPath = config.SPEC_PATH || specRoot;

      logger.info('📚 Initializing knowledge service...');
      await this.knowledgeService.initialize(specPath);

      // Get the API data from knowledge service for search service
      const apiData =
        (this.knowledgeService as any).knowledgeRepository?.apiData ||
        new Map<string, unknown>();

      logger.info('🔍 Initializing API search service...');
      await this.searchService.initialize(apiData);

      logger.info('⚙️ Initializing code generation service...');
      await this.codeGenerationService.initialize();

      logger.info('🔄 Initializing session service...');
      await this.sessionService.initialize();

      this.initialized = true;
      logger.info('✅ All PrivMX services initialized successfully');

      // Log service statistics
      const knowledgeStats = this.knowledgeService.getStats();
      const apiStats = knowledgeStats.apiSearchStats;
      logger.info(`   📊 ${apiStats.namespaces} namespaces indexed`);
      logger.info(`   🔧 ${apiStats.methods} methods indexed`);
      logger.info(`   📋 ${apiStats.classes} classes indexed`);
      logger.info(`   🌍 ${apiStats.languages} languages supported`);
    } catch (error) {
      logger.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Sets up MCP request handlers for tools and capabilities
   */
  private setupHandlers(): void {
    // Handle list tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(z.object(tool.schema)),
        })),
      };
    });

    // Handle tool call requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureInitialized();

      const { name, arguments: args } = request.params;
      const tool = this.toolMap.get(name);

      if (!tool) {
        logger.error(`Tool not found: ${name}`);
        throw new McpError(-32601, `Tool not found: ${name}`);
      }

      try {
        return await startSpan(`tool.${name}`, async () => {
          logger.info(`🛠️ Executing tool: ${name}`);

          // Validate tool arguments against schema
          const validationResult = z.object(tool.schema).safeParse(args);
          if (!validationResult.success) {
            logger.error(`Invalid arguments for tool ${name}`, {
              errors: validationResult.error.flatten(),
            });
            throw new McpError(
              -32602,
              'Invalid arguments',
              validationResult.error.flatten()
            );
          }

          // Execute the tool with validated arguments
          const result = await tool.handler(validationResult.data as never);
          logger.info(`✅ Tool ${name} completed successfully`);

          return result as unknown as { [x: string]: unknown };
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        logger.error(`❌ Error executing tool ${name}:`, error);
        throw new McpError(-32603, errorMessage);
      }
    });
  }

  /**
   * Starts the MCP server and connects to stdio transport
   */
  async run(): Promise<void> {
    logger.info('🚀 Starting PrivMX MCP Server (with focused services)...');
    logger.info(`📊 Available tools: ${this.tools.length}`);

    await this.ensureInitialized();

    const transport = new StdioServerTransport();
    this.server.connect(transport);

    logger.info('✅ PrivMX MCP Server is running and ready to assist!');
    logger.info(
      '🎯 Using focused services architecture for better performance'
    );
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const server = new PrivMXMCPServer();
    await server.run();
  } catch (error) {
    logger.error('❌ Failed to start PrivMX MCP Server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down PrivMX MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down PrivMX MCP Server...');
  process.exit(0);
});

main();
