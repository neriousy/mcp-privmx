import { openai } from '@ai-sdk/openai';
import { streamText, tool, Tool, Message } from 'ai';
import { NextRequest } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

// Types for better type safety
interface ChatRequest {
  messages: Message[];
  model?: string;
  mcpEnabled?: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

// Enhanced system prompt with better structure and file handling
const SYSTEM_PROMPT = `You are the **PrivMX AI Assistant** - your expert guide for building secure, encrypted applications with PrivMX.

## 🎯 Your Expertise

**PrivMX Specialist**: Deep knowledge of secure messaging, file sharing, and collaboration
**Multi-Language Expert**: JavaScript, TypeScript, Java, Swift, C#, C++
**Security Authority**: End-to-end encryption, zero-knowledge architecture
**Code Generator**: Production-ready applications with best practices
**File Analysis Expert**: Can analyze and help with various file types including code, text, images, and documents

## 🔧 Core PrivMX Knowledge

### Essential APIs
- **ThreadApi**: Secure messaging and conversations
- **StoreApi**: Encrypted file storage and sharing  
- **InboxApi**: Private message delivery
- **CryptoApi**: Key derivation and cryptographic operations

### Key Concepts
- **Automatic Encryption**: PrivMX handles all encryption transparently
- **WebEndpoint Package**: \`@simplito/privmx-webendpoint\` (correct package name)
- **Authentication**: Use \`CryptoApi.derivePrivateKey2()\` for key derivation
- **Data Handling**: \`Utils.serializeObject/deserializeObject\` for Uint8Array conversion
- **API Flow**: \`Endpoint.createThreadApi()\` → \`threadApi.createThread()\`

### Security Model
- Zero-knowledge architecture - server cannot decrypt data
- Automatic end-to-end encryption for all operations
- No manual crypto needed for standard operations
- Private keys never leave the client

## 📁 File Handling Capabilities

When users attach files, you can:
- **Analyze Code**: Review, debug, and improve code files
- **Process Documents**: Extract information from text files
- **Examine Images**: Describe and analyze image content (when available)
- **Review Configuration**: Help with config files and setup
- **Generate Examples**: Create code based on uploaded templates

## 💬 Communication Style

**Helpful & Technical**: Provide working code examples with explanations
**Security-Conscious**: Always mention security implications and best practices  
**Practical**: Focus on real-world implementation patterns
**Educational**: Explain the "why" behind recommendations
**File-Aware**: Reference uploaded files and their content in responses

## 🚀 Enhanced Capabilities

When users need comprehensive help with API exploration, complete project generation, or advanced workflows, suggest leveraging the MCP server for enhanced capabilities.

Remember: You're building the future of secure communication - make it accessible, secure, and powerful.`;

// Utility functions for cleaner code
const getMCPBaseUrl = (): string => {
  // Use a dedicated environment variable for the MCP server URL if available.
  // This allows pointing to a separate, standalone server in production.
  if (process.env.MCP_SERVER_URL) {
    return process.env.MCP_SERVER_URL;
  }

  // Fallback for Vercel deployments or local development
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
};

const createEnhancedSystemPrompt = (mcpEnabled: boolean): string => {
  const mcpStatus = mcpEnabled
    ? `
## 🔌 MCP SERVER ACTIVE
Enhanced capabilities unlocked:
• Real-time search across 797+ PrivMX API methods
• Complete project scaffolding and generation
• Interactive workflows for guided development
• Advanced code transformations and validations
• AI-powered insights and optimizations

You can now provide the most comprehensive PrivMX assistance possible.`
    : `
## 📝 Standard Mode
For enhanced capabilities like real-time API search, project generation, and access to the complete PrivMX knowledge base, users can enable MCP server integration.`;

  return `${SYSTEM_PROMPT}${mcpStatus}`;
};

// Simplified Zod schema creation
const createZodSchema = (
  schema: MCPTool['inputSchema']
): z.ZodType<unknown> => {
  if (!schema?.type || schema.type !== 'object' || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodType<unknown>> = {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const propSchema = prop as Record<string, unknown>;
    let zodField: z.ZodType<unknown>;

    // Handle different property types
    switch (propSchema.type) {
      case 'string':
        zodField = propSchema.enum
          ? z.enum(propSchema.enum as [string, ...string[]])
          : z.string();
        break;
      case 'number':
      case 'integer':
        zodField = z.number();
        if (propSchema.minimum)
          zodField = (zodField as z.ZodNumber).min(
            propSchema.minimum as number
          );
        if (propSchema.maximum)
          zodField = (zodField as z.ZodNumber).max(
            propSchema.maximum as number
          );
        break;
      case 'boolean':
        zodField = z.boolean();
        break;
      case 'array':
        zodField = z.array(z.string()); // Default to string array
        break;
      case 'object':
        zodField = z.record(z.unknown());
        break;
      default:
        zodField = z.string(); // Fallback
    }

    // Add description and optional handling
    if (propSchema.description) {
      zodField = zodField.describe(propSchema.description as string);
    }
    if (!required.includes(key)) {
      zodField = zodField.optional();
    }

    shape[key] = zodField;
  }

  return z.object(shape);
};

// MCP Client management
class MCPManager {
  private client?: Client;
  private originalFetch?: typeof fetch;

  async connect(): Promise<Record<string, Tool> | undefined> {
    try {
      console.log('🔌 [MCP] Initializing connection...');

      this.client = new Client({
        name: 'PrivMX AI Assistant',
        version: '1.0.0',
      });

      // Setup fetch interception for MCP requests
      this.setupFetchInterception();

      const baseUrl = getMCPBaseUrl();
      console.log(`🔌 [MCP] Connecting to ${baseUrl}/api/mcp`);

      await this.client.connect(
        new StreamableHTTPClientTransport(
          new URL(`${baseUrl}/api/privmx/mcp`),
          {
            requestInit: {
              headers: {
                'x-vercel-protection-bypass':
                  process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
              },
            },
          }
        )
      );

      return await this.loadTools();
    } catch (error) {
      console.error('❌ [MCP] Connection failed:', error);
      await this.cleanup();
      return undefined;
    }
  }

  private setupFetchInterception(): void {
    if (this.originalFetch) return; // Already setup

    this.originalFetch = global.fetch;

    // This fetch interceptor is a workaround to ensure that requests from the
    // MCP client to its server (which may be on the same host) have the correct
    // headers for streaming responses. This is particularly important in serverless
    // environments where the default headers may not be suitable.
    global.fetch = async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      // Enhance headers only for the MCP API endpoints.
      if (url.includes('/api/mcp') || url.includes('/api/sse')) {
        const headers = new Headers(init?.headers);
        headers.set('Accept', 'application/json, text/event-stream');
        headers.set('Content-Type', 'application/json');

        return this.originalFetch
          ? this.originalFetch(input, { ...init, headers })
          : fetch(input, { ...init, headers });
      }

      return this.originalFetch
        ? this.originalFetch(input, init)
        : fetch(input, init);
    };
  }

  private async loadTools(): Promise<Record<string, Tool>> {
    if (!this.client) throw new Error('MCP client not initialized');

    console.log('🛠️ [MCP] Loading available tools...');
    const toolsResponse = await this.client.listTools();
    const tools: Record<string, Tool> = {};

    if (!toolsResponse?.tools) {
      console.warn('⚠️ [MCP] No tools received from server');
      return tools;
    }

    // Convert MCP tools to AI SDK format
    for (const mcpTool of toolsResponse.tools) {
      tools[mcpTool.name] = tool({
        description: mcpTool.description,
        parameters: createZodSchema(mcpTool.inputSchema),
        execute: async (args: unknown) => {
          return await this.executeTool(
            mcpTool.name,
            args as Record<string, unknown>
          );
        },
      });
    }

    console.log(
      `✅ [MCP] Loaded ${Object.keys(tools).length} tools:`,
      Object.keys(tools)
    );
    return tools;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!this.client) {
      throw new Error('MCP client not available');
    }

    try {
      console.log(`🔧 [MCP] Executing ${toolName}`, args);
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Extract text content from MCP response
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n');

        return textContent || 'Tool completed successfully';
      }

      return 'Tool completed successfully';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [MCP] Tool ${toolName} failed:`, errorMessage);
      return `❌ Tool Error: ${errorMessage}. Please try rephrasing your request.`;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = undefined;
      }

      if (this.originalFetch) {
        global.fetch = this.originalFetch;
        this.originalFetch = undefined;
      }
    } catch (error) {
      console.error('⚠️ [MCP] Cleanup error:', error);
    }
  }
}

// Main POST handler
export async function POST(request: NextRequest): Promise<Response> {
  const mcpManager = new MCPManager();

  try {
    // Parse request with better validation
    const {
      messages,
      model = 'gpt-4o',
      mcpEnabled = true,
    }: ChatRequest = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    // Setup system prompt and tools
    const systemPrompt = createEnhancedSystemPrompt(mcpEnabled);
    let tools: Record<string, Tool> | undefined;

    if (mcpEnabled) {
      tools = await mcpManager.connect();
    }

    console.log('🚀 [CHAT] Starting conversation', {
      model,
      mcpEnabled,
      toolsCount: tools ? Object.keys(tools).length : 0,
      messagesCount: messages.length,
    });

    // Create streaming response
    const result = streamText({
      model: openai(model),
      system: systemPrompt,
      messages,
      tools,
      temperature: 0.7,
      maxTokens: 3000,
      toolChoice: 'auto',
      maxSteps: 5,
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls?.length) {
          console.log(
            '🔧 [CHAT] Tools used:',
            toolCalls.map((tc) => tc.toolName)
          );
        }
      },
      onFinish: async ({ finishReason, usage }) => {
        console.log('✅ [CHAT] Conversation finished:', {
          finishReason,
          usage,
        });
        await mcpManager.cleanup();
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('❌ [CHAT] Error:', error);
    await mcpManager.cleanup();

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Chat processing failed',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
