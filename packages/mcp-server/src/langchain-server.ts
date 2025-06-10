#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { APIKnowledgeService } from './services/api-knowledge-service.js';
import { config } from './common/config.js';
import { specRoot } from './common/paths.js';
import logger from './common/logger.js';
import { getTools } from './tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

/**
 * PrivMX Code Generation MCP Server
 * Fast, deterministic API knowledge graph with code generation capabilities
 */

interface ServerCapabilities {
  [x: string]: unknown;
  tools: Record<string, { description: string }>;
}

class LangChainPrivMXServer {
  private server: Server;
  private docService: APIKnowledgeService;
  private initialized = false;
  private tools: ReturnType<typeof getTools>;
  private toolMap: Map<string, ReturnType<typeof getTools>[number]>;

  constructor() {
    this.docService = new APIKnowledgeService({
      specPath: config.SPEC_PATH || specRoot,
      supportedLanguages: [
        'javascript',
        'typescript',
        'java',
        'swift',
        'cpp',
        'csharp',
      ],
    });

    this.tools = getTools(this.docService);
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
        name: 'privmx-code-generator',
        version: '2.0.0',
      },
      { capabilities }
    );

    this.setupHandlers();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.docService.initialize();
    this.initialized = true;
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(z.object(tool.schema)),
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureInitialized();

      const { name, arguments: args } = request.params;
      const tool = this.toolMap.get(name);

      if (!tool) {
        logger.error(`Tool not found: ${name}`);
        throw new McpError(-32601, `Tool not found: ${name}`);
      }

      try {
        logger.info(`Calling tool: ${name}`, { args: args });
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

        const result = await tool.handler(validationResult.data as never);
        return result as unknown as { [x: string]: unknown };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        logger.error(`Error calling tool ${name}:`, error);
        throw new McpError(-32603, errorMessage);
      }
    });
  }

  async run(): Promise<void> {
    logger.info('Starting PrivMX Code Generator Server...');
    await this.ensureInitialized();
    const transport = new StdioServerTransport();
    this.server.connect(transport);
    logger.info('PrivMX Code Generator Server is running.');
  }
}

async function main(): Promise<void> {
  try {
    const server = new LangChainPrivMXServer();
    await server.run();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
