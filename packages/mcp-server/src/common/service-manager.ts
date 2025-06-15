import { APISearchService } from '../services/api/api-search-service.js';
import { CodeGenerationService } from '../services/generation/code-generation-service.js';
import { KnowledgeService } from '../services/knowledge/knowledge-service.js';
import { InteractiveSessionService } from '../services/workflow/interactive-session-service.js';

/**
 * Centralised singleton manager that lazily instantiates core services once per process.
 * This prevents expensive re-initialisation when MCP server is embedded (e.g. in Vercel route handler).
 */
class ServiceManager {
  private static _instance: ServiceManager;

  // Service singletons
  private _searchService?: APISearchService;
  private _codeGenService?: CodeGenerationService;
  private _knowledgeService?: KnowledgeService;
  private _sessionService?: InteractiveSessionService;

  private constructor() {}

  public static get instance(): ServiceManager {
    if (!this._instance) this._instance = new ServiceManager();
    return this._instance;
  }

  public async getKnowledgeService(): Promise<KnowledgeService> {
    if (!this._knowledgeService) {
      this._knowledgeService = new KnowledgeService();
      await this._knowledgeService.initialize();
    }
    return this._knowledgeService;
  }

  public async getSearchService(): Promise<APISearchService> {
    if (!this._searchService) {
      const knowledge = await this.getKnowledgeService();
      const apiData =
        (knowledge as any).knowledgeRepository?.apiData ?? new Map();
      this._searchService = new APISearchService();
      await this._searchService.initialize(apiData);
    }
    return this._searchService;
  }

  public async getCodeGenerationService(): Promise<CodeGenerationService> {
    if (!this._codeGenService) {
      this._codeGenService = new CodeGenerationService();
      await this._codeGenService.initialize();
    }
    return this._codeGenService;
  }

  public async getSessionService(): Promise<InteractiveSessionService> {
    if (!this._sessionService) {
      this._sessionService = new InteractiveSessionService();
      await this._sessionService.initialize();
    }
    return this._sessionService;
  }
}

export default ServiceManager.instance;
