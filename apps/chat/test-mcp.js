import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testMCP() {
  console.log('🔧 Testing MCP connection...');

  const mcpClient = new Client({
    name: 'Test MCP Client',
    version: '1.0.0',
  });

  try {
    // Store original fetch to restore later
    const originalFetch = global.fetch;

    // Override global fetch for MCP requests
    global.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      // Only modify headers for MCP endpoint requests
      if (url.includes('/api/mcp')) {
        console.log('🔧 Intercepting MCP request to:', url);
        const headers = new Headers(init?.headers);
        headers.set('Accept', 'application/json, text/event-stream');
        headers.set('Content-Type', 'application/json');

        console.log(
          '🔧 Headers being sent:',
          Object.fromEntries(headers.entries())
        );

        return originalFetch(input, {
          ...init,
          headers,
        });
      }

      return originalFetch(input, init);
    };

    try {
      console.log('🔧 Connecting to MCP server...');
      await mcpClient.connect(
        new StreamableHTTPClientTransport(
          new URL('http://localhost:3000/api/mcp')
        )
      );

      console.log('🔧 Connection successful! Getting tools...');
      const toolsResponse = await mcpClient.listTools();
      console.log('🔧 Tools response:', JSON.stringify(toolsResponse, null, 2));

      console.log('✅ MCP test successful!');
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  } catch (error) {
    console.error('❌ MCP test failed:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Error stack:', error.stack);
  } finally {
    try {
      await mcpClient.close();
    } catch (e) {
      console.error('Error closing client:', e);
    }
  }
}

testMCP();
