import path from 'path';
import { APISearchService } from '@privmx/mcp-server/services/api/api-search-service';
import { CodeGenerationService } from '@privmx/mcp-server/services/generation/code-generation-service';
import { InteractiveSessionService } from '@privmx/mcp-server/services/workflow/interactive-session-service';
import { KnowledgeService } from '@privmx/mcp-server/services/knowledge/knowledge-service';
import { getTools } from '@privmx/mcp-server/tools';

export interface ServiceContainer {
  searchService: APISearchService;
  codeGenerationService: CodeGenerationService;
  sessionService: InteractiveSessionService;
  knowledgeService: KnowledgeService;
}

export interface ServiceStats {
  initialized: boolean;
  initializationTime?: number;
  lastInitialized?: Date;
  serviceCount: number;
  vectorServiceEnabled: boolean;
}

/**
 * Singleton ServiceManager for managing PrivMX MCP services
 * Eliminates service recreation on each request and optimizes cold starts
 */
export class ServiceManager {
  private static instance: ServiceManager;
  private services: ServiceContainer | null = null;
  private tools: ReturnType<typeof getTools> | null = null;
  private capabilities: any = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private initializationStartTime: number = 0;
  private initializationTime: number = 0;
  private lastInitialized: Date | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of ServiceManager
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize all services (called once, cached thereafter)
   */
  async initializeServices(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.initialized && this.services) {
      return;
    }

    this.initPromise = this._performInitialization();
    await this.initPromise;
  }

  /**
   * Perform the actual service initialization
   */
  private async _performInitialization(): Promise<void> {
    try {
      this.initializationStartTime = Date.now();
      console.log(
        '🚀 [ServiceManager] Initializing PrivMX services (singleton)...'
      );

      // Create service instances (only once)
      const searchService = new APISearchService();
      const codeGenerationService = new CodeGenerationService();
      const sessionService = new InteractiveSessionService();
      const knowledgeService = new KnowledgeService();

      // Create service container
      this.services = {
        searchService,
        codeGenerationService,
        sessionService,
        knowledgeService,
      };

      // Initialize knowledge service first (handles complex setup)
      const specPath = path.join(process.cwd(), 'spec');

      console.log('📚 [ServiceManager] Initializing knowledge service...');
      if (process.env.OPENAI_API_KEY) {
        console.log(
          '🧠 [ServiceManager] Vector search enabled - using persistent document index'
        );
      } else {
        console.log(
          '📝 [ServiceManager] Vector search disabled - using text-based search only'
        );
      }

      await knowledgeService.initialize(specPath);

      // Initialize other services
      console.log(
        '🏗️ [ServiceManager] Initializing code generation service...'
      );
      await codeGenerationService.initialize();

      console.log('🔄 [ServiceManager] Initializing session service...');
      await sessionService.initialize();

      // Generate tools and capabilities
      this.tools = getTools(this.services);
      this.capabilities = {
        tools: this.tools.reduce(
          (acc, tool) => {
            acc[tool.name] = { description: tool.description };
            return acc;
          },
          {} as Record<string, { description: string }>
        ),
      };

      this.initialized = true;
      this.initializationTime = Date.now() - this.initializationStartTime;
      this.lastInitialized = new Date();

      console.log(
        `✅ [ServiceManager] All services initialized successfully in ${this.initializationTime}ms`
      );

      // Log service statistics
      const stats = this.getStats();
      console.log(`   📊 Services initialized: ${stats.serviceCount}`);
      console.log(
        `   🧠 Vector search: ${stats.vectorServiceEnabled ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      console.error(
        '❌ [ServiceManager] Failed to initialize services:',
        error
      );
      this.initPromise = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Get the service container (ensure initialization first)
   */
  async getServices(): Promise<ServiceContainer> {
    await this.initializeServices();

    if (!this.services) {
      throw new Error('Services not available after initialization');
    }

    return this.services;
  }

  /**
   * Get specific service instances
   */
  async getKnowledgeService(): Promise<KnowledgeService> {
    const services = await this.getServices();
    return services.knowledgeService;
  }

  async getSearchService(): Promise<APISearchService> {
    const services = await this.getServices();
    return services.searchService;
  }

  async getCodeGenerationService(): Promise<CodeGenerationService> {
    const services = await this.getServices();
    return services.codeGenerationService;
  }

  async getSessionService(): Promise<InteractiveSessionService> {
    const services = await this.getServices();
    return services.sessionService;
  }

  /**
   * Get tools (ensure initialization first)
   */
  async getTools(): Promise<ReturnType<typeof getTools>> {
    await this.initializeServices();

    if (!this.tools) {
      throw new Error('Tools not available after initialization');
    }

    return this.tools;
  }

  /**
   * Get capabilities (ensure initialization first)
   */
  async getCapabilities(): Promise<any> {
    await this.initializeServices();

    if (!this.capabilities) {
      throw new Error('Capabilities not available after initialization');
    }

    return this.capabilities;
  }

  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get service statistics
   */
  getStats(): ServiceStats {
    return {
      initialized: this.initialized,
      initializationTime: this.initializationTime || undefined,
      lastInitialized: this.lastInitialized || undefined,
      serviceCount: this.services ? 4 : 0,
      vectorServiceEnabled: !!process.env.OPENAI_API_KEY,
    };
  }

  /**
   * Force re-initialization (useful for development or after configuration changes)
   */
  async reinitialize(): Promise<void> {
    console.log('🔄 [ServiceManager] Force re-initializing services...');

    this.initialized = false;
    this.services = null;
    this.tools = null;
    this.capabilities = null;
    this.initPromise = null;

    await this.initializeServices();
  }

  /**
   * Get detailed service information for debugging
   */
  async getDetailedStats(): Promise<{
    serviceManager: ServiceStats;
    knowledgeService?: any;
    searchService?: any;
  }> {
    const baseStats = this.getStats();

    if (!this.initialized || !this.services) {
      return { serviceManager: baseStats };
    }

    try {
      const knowledgeStats = this.services.knowledgeService.getStats();
      const searchStats = this.services.searchService.getStats();

      return {
        serviceManager: baseStats,
        knowledgeService: knowledgeStats,
        searchService: searchStats,
      };
    } catch (error) {
      console.warn('[ServiceManager] Could not get detailed stats:', error);
      return { serviceManager: baseStats };
    }
  }
}

/**
 * Convenience function to get the singleton instance
 */
export const getServiceManager = (): ServiceManager => {
  return ServiceManager.getInstance();
};
