import { openai } from '@ai-sdk/openai';
import {
  streamText,
  experimental_createMCPClient as createMCPClient,
  tool,
} from 'ai';
import { NextRequest } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';

// System prompt that explains the assistant's capabilities
const SYSTEM_PROMPT = `You are the PrivMX AI Assistant, an expert in PrivMX development and secure communication applications.

## Your Core Capabilities:

### 🔧 **Code Generation**
- Generate production-ready PrivMX code in 5 languages: JavaScript, TypeScript, Java, Swift, C#
- Create complete applications with proper authentication patterns
- Build secure messaging, file sharing, and collaboration features
- Understand PrivMX's automatic encryption (no manual crypto needed)

### 🔍 **API Knowledge** 
- Know all 797 PrivMX methods across 126 classes
- Provide accurate API usage examples and best practices
- Explain authentication using CryptoApi.derivePrivateKey2() 
- Show proper data handling with Utils.serializeObject/deserializeObject

### 🏗️ **Architecture Guidance**
- Design secure communication architectures
- Recommend best practices for PrivMX applications
- Explain WebEndpoint automatic encryption capabilities
- Guide on proper Thread, Store, Inbox, and Crypto API usage

## Key PrivMX Concepts to Remember:
- PrivMX WebEndpoint handles all encryption automatically
- Utils.serializeObject/deserializeObject are just TextEncoder/TextDecoder helpers for Uint8Array conversion
- Authentication uses key derivation (CryptoApi.derivePrivateKey2)
- No manual encryption/decryption needed for normal operations
- The correct package name is @simplito/privmx-webendpoint (not privmx-webclient)
- Use Endpoint.createThreadApi() to get ThreadApi, then threadApi.createThread() to create threads

## Your Response Style:
- Be conversational but technical when needed
- Provide working code examples
- Explain security implications
- Always mention when MCP server could provide enhanced capabilities

When users ask about PrivMX development, provide helpful, accurate information. If enhanced capabilities would help (like searching the full API database or generating complete projects), mention that connecting to the MCP server would unlock additional features.`;

export async function POST(request: NextRequest) {
  let mcpClient: Client | undefined;
  let originalFetch: typeof fetch | undefined;

  try {
    const {
      messages,
      model = 'gpt-4o',
      mcpEnabled = true, // Default to true since we're setting up MCP
    } = await request.json();

    // Add MCP context to system prompt if enabled
    const systemPrompt = mcpEnabled
      ? `${SYSTEM_PROMPT}

🚀 **MCP SERVER CONNECTED** - You now have access to:
- Real-time search of 797 PrivMX API methods
- Complete workflow generation capabilities  
- Multi-language code generation with full project scaffolding
- Enhanced examples from the live PrivMX API database

When users ask for specific APIs, code generation, or workflows, you can provide even more detailed and accurate responses using your enhanced knowledge base.`
      : `${SYSTEM_PROMPT}

📝 **Note**: For enhanced capabilities like real-time API search, complete project generation, and access to the full PrivMX knowledge base, the user can enable the MCP server connection.`;

    // Initialize MCP client if enabled
    let tools: Record<string, any> | undefined;
    if (mcpEnabled) {
      console.log('🔧 [MCP] MCP is enabled, attempting to connect...');
      try {
        // Determine the base URL for MCP connection
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';

        console.log('🔧 [MCP] Connecting to', `${baseUrl}/api/mcp`);

        mcpClient = new Client({
          name: 'PrivMX MCP Client',
          version: '1.0.0',
        });

        // Store original fetch to restore later
        originalFetch = global.fetch;

        // Override global fetch for MCP requests
        global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : (input as Request).url;

          // Only modify headers for MCP endpoint requests
          if (url.includes('/api/mcp')) {
            console.log('🔧 [MCP] Intercepting request to:', url);
            const headers = new Headers(init?.headers);
            headers.set('Accept', 'application/json, text/event-stream');
            headers.set('Content-Type', 'application/json');
            console.log(
              '🔧 [MCP] Headers being sent:',
              Object.fromEntries(headers.entries())
            );

            return originalFetch!(input, {
              ...init,
              headers,
            });
          }

          return originalFetch!(input, init);
        };

        let toolsResponse: any;
        try {
          console.log('🔧 [MCP] Connecting to MCP server...');
          await mcpClient.connect(
            new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/mcp`))
          );

          console.log('🔧 [MCP] Connection established, initializing client');

          // Get tools from MCP server
          console.log('🔧 [MCP] Getting tools');
          toolsResponse = await mcpClient.listTools();
          console.log(
            '🔧 [MCP] Tools response received, tool count:',
            toolsResponse?.tools?.length || 0
          );
        } finally {
          // Don't restore fetch immediately - keep it for tool calls
          // global.fetch = originalFetch;
        }

        // Transform MCP tools to proper AI SDK format
        tools = {};
        if (toolsResponse?.tools) {
          for (const mcpTool of toolsResponse.tools) {
            console.log(`🔧 [MCP] Processing tool: ${mcpTool.name}`);

            // Convert JSON Schema to Zod schema
            const createZodSchema = (schema: any): z.ZodType<any> => {
              if (schema.type === 'object' && schema.properties) {
                const shape: Record<string, z.ZodType<any>> = {};
                for (const [key, prop] of Object.entries(schema.properties)) {
                  const propSchema = prop as any;
                  if (propSchema.type === 'string') {
                    let zodField: z.ZodType<any> = z.string();
                    if (propSchema.description) {
                      zodField = zodField.describe(propSchema.description);
                    }
                    if (!schema.required?.includes(key)) {
                      zodField = zodField.optional();
                    }
                    shape[key] = zodField;
                  } else if (
                    propSchema.type === 'number' ||
                    propSchema.type === 'integer'
                  ) {
                    let zodField: z.ZodType<any> = z.number();
                    if (propSchema.description) {
                      zodField = zodField.describe(propSchema.description);
                    }
                    if (!schema.required?.includes(key)) {
                      zodField = zodField.optional();
                    }
                    shape[key] = zodField;
                  } else if (propSchema.type === 'array') {
                    let zodField: z.ZodType<any> = z.array(z.string()); // Default to string array
                    if (propSchema.description) {
                      zodField = zodField.describe(propSchema.description);
                    }
                    if (!schema.required?.includes(key)) {
                      zodField = zodField.optional();
                    }
                    shape[key] = zodField;
                  } else {
                    // Fallback to string for unknown types
                    let zodField: z.ZodType<any> = z.string();
                    if (propSchema.description) {
                      zodField = zodField.describe(propSchema.description);
                    }
                    if (!schema.required?.includes(key)) {
                      zodField = zodField.optional();
                    }
                    shape[key] = zodField;
                  }
                }
                return z.object(shape);
              }
              return z.object({});
            };

            tools[mcpTool.name] = tool({
              description: mcpTool.description,
              parameters: createZodSchema(
                mcpTool.inputSchema || { type: 'object', properties: {} }
              ),
              execute: async (args: any) => {
                console.log(`🛠️ [MCP] Executing tool: ${mcpTool.name}`, args);
                try {
                  const result = await mcpClient!.callTool({
                    name: mcpTool.name,
                    arguments: args,
                  });
                  console.log(
                    `✅ [MCP] Tool ${mcpTool.name} executed successfully`
                  );

                  // Extract text content from MCP response
                  if (result.content && Array.isArray(result.content)) {
                    const textContent = result.content
                      .filter((item: any) => item.type === 'text')
                      .map((item: any) => item.text)
                      .join('\n');
                    return textContent || 'Tool completed successfully';
                  }

                  return 'Tool completed successfully';
                } catch (error) {
                  console.error(
                    `❌ [MCP] Error calling tool ${mcpTool.name}:`,
                    error
                  );
                  const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';
                  return `❌ Tool Error: ${errorMessage}. Please try rephrasing your request.`;
                }
              },
            });
          }
        }

        console.log('🔧 [MCP] Converted MCP tools to proper AI SDK format');

        console.log('🔧 [MCP] Connected and loaded tools:', Object.keys(tools));
        console.log(
          '🔧 [MCP] Sample tool parameters:',
          tools[Object.keys(tools)[0]]?.parameters
        );
        console.log(
          '🔧 [MCP] Tools object structure check passed:',
          typeof tools === 'object'
        );
      } catch (error) {
        console.error('❌ [MCP] Failed to connect:', error);
        console.error(
          '❌ [MCP] Error details:',
          error instanceof Error ? error.message : String(error)
        );
        console.error(
          '❌ [MCP] Error stack:',
          error instanceof Error ? error.stack : 'No stack trace'
        );
        // Continue without MCP tools if connection fails
        tools = undefined;
      }
    }

    console.log(
      '🔧 [CHAT] Starting streamText with tools:',
      tools ? Object.keys(tools).length : 'no tools'
    );

    try {
      const result = streamText({
        model: openai(model),
        system: systemPrompt,
        messages,
        tools,
        temperature: 0.7,
        maxTokens: 2000,
        toolChoice: 'auto',
        maxSteps: 5,
        onStepFinish: ({ stepType, toolCalls, toolResults }) => {
          console.log('🔧 [CHAT] Step finished:', stepType);
          if (toolCalls) {
            console.log(
              '🔧 [CHAT] Tool calls:',
              toolCalls.map((tc) => tc.toolName)
            );
          }
          if (toolResults) {
            console.log('🔧 [CHAT] Tool results count:', toolResults.length);
          }
        },
        onFinish: async ({ text, finishReason, usage }) => {
          console.log('🔧 [CHAT] Finished:', {
            finishReason,
            usage,
            textLength: text?.length,
          });
          if (mcpClient) {
            try {
              await mcpClient.close();
            } catch (error) {
              console.error('Error closing MCP client:', error);
            }
          }
          // Restore original fetch when done
          if (typeof originalFetch !== 'undefined') {
            global.fetch = originalFetch;
          }
        },
      });

      console.log('🔧 [CHAT] streamText created, converting to response');
      return result.toDataStreamResponse();
    } catch (streamError) {
      console.error('❌ [CHAT] Error in streamText:', streamError);
      console.error(
        '❌ [CHAT] Error details:',
        streamError instanceof Error ? streamError.message : String(streamError)
      );
      console.error(
        '❌ [CHAT] Error stack:',
        streamError instanceof Error ? streamError.stack : 'No stack trace'
      );

      // Fallback response
      return new Response(
        JSON.stringify({
          error: 'Streaming error occurred',
          details:
            streamError instanceof Error
              ? streamError.message
              : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (closeError) {
        console.error('Error closing MCP client after error:', closeError);
      }
    }
    return new Response('Internal Server Error', { status: 500 });
  }
}
