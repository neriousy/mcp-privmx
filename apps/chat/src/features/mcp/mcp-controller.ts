import { ServiceManager } from '@/lib/services/service-manager';

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
    [key: string]: string | number | boolean;
  }>;
}

export interface MCPCapabilities {
  tools: Record<string, { description: string }>;
}

export interface MCPToolExecution {
  toolName: string;
  args: Record<string, unknown>;
  startTime: number;
}

/**
 * MCP Controller - Handles all MCP-related business logic
 * Separated from route handlers for better maintainability
 */
export class MCPController {
  private serviceManager: ServiceManager;

  constructor() {
    this.serviceManager = ServiceManager.getInstance();
  }

  /**
   * Initialize MCP services and return capabilities
   */
  async initialize(): Promise<MCPCapabilities> {
    try {
      console.log('🔌 [MCPController] Initializing MCP services...');

      // Use singleton service manager - services will only be initialized once
      const capabilities = await this.serviceManager.getCapabilities();

      const stats = this.serviceManager.getStats();
      console.log(
        `✅ [MCPController] MCP ready - ${stats.serviceCount} services initialized`
      );

      return capabilities;
    } catch (error) {
      console.error('❌ [MCPController] Failed to initialize MCP:', error);
      throw new Error(
        `MCP initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get available tools without re-initializing services
   */
  async getTools() {
    try {
      return await this.serviceManager.getTools();
    } catch (error) {
      console.error('❌ [MCPController] Failed to get tools:', error);
      throw new Error(
        `Failed to get tools: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute a tool with proper error handling and logging
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResponse> {
    const execution: MCPToolExecution = {
      toolName,
      args,
      startTime: Date.now(),
    };

    try {
      console.log(`🛠️ [MCPController] Executing tool: ${toolName}`);
      console.log(`📥 [MCPController] Input:`, JSON.stringify(args, null, 2));

      // Get tools from service manager
      const tools = await this.getTools();
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Execute the tool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.handler(args as any);

      const executionTime = Date.now() - execution.startTime;
      console.log(
        `⏱️ [MCPController] ${toolName} completed in ${executionTime}ms`
      );

      return result as MCPToolResponse;
    } catch (error) {
      return this.handleToolError(execution, error);
    }
  }

  /**
   * Handle tool execution errors with proper formatting
   */
  private handleToolError(
    execution: MCPToolExecution,
    error: unknown
  ): MCPToolResponse {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const executionTime = Date.now() - execution.startTime;

    console.error(
      `❌ [MCPController] ${execution.toolName} failed after ${executionTime}ms:`,
      {
        message: errorMessage,
        context: execution.args,
        ...(error instanceof Error && { stack: error.stack }),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error in ${execution.toolName}: ${errorMessage}`,
        },
      ],
    };
  }

  /**
   * Get MCP service statistics
   */
  async getServiceStats() {
    try {
      return await this.serviceManager.getDetailedStats();
    } catch (error) {
      console.error('❌ [MCPController] Failed to get service stats:', error);
      return {
        serviceManager: this.serviceManager.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if MCP services are ready
   */
  isReady(): boolean {
    return this.serviceManager.isInitialized();
  }

  /**
   * Force re-initialization of services (for development/debugging)
   */
  async reinitialize(): Promise<MCPCapabilities> {
    try {
      console.log('🔄 [MCPController] Re-initializing MCP services...');
      await this.serviceManager.reinitialize();
      return await this.serviceManager.getCapabilities();
    } catch (error) {
      console.error('❌ [MCPController] Failed to re-initialize MCP:', error);
      throw new Error(
        `MCP re-initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get list of available tools with metadata
   */
  async getToolList() {
    try {
      const tools = await this.getTools();
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        // Note: schema is not exposed for security, but could be added if needed
      }));
    } catch (error) {
      console.error('❌ [MCPController] Failed to get tool list:', error);
      throw error;
    }
  }

  /**
   * Validate tool arguments against schema
   */
  async validateToolArgs(
    toolName: string,
    _args: Record<string, unknown>
  ): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    try {
      const tools = await this.getTools();
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        return {
          valid: false,
          errors: [`Tool not found: ${toolName}`],
        };
      }

      // Here you would validate against the tool's schema
      // For now, we'll just return valid since we don't have schema validation implemented
      return {
        valid: true,
      };
    } catch (error) {
      console.error('❌ [MCPController] Failed to validate tool args:', error);
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}
