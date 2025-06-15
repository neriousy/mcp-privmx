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

  // Initialization promises to prevent race conditions
  private _searchInit?: Promise<APISearchService>;
  private _codeGenInit?: Promise<CodeGenerationService>;
  private _knowledgeInit?: Promise<KnowledgeService>;
  private _sessionInit?: Promise<InteractiveSessionService>;

  private constructor() {}

  public static get instance(): ServiceManager {
    if (!this._instance) this._instance = new ServiceManager();
    return this._instance;
  }

  public async getKnowledgeService(): Promise<KnowledgeService> {
    if (this._knowledgeService) {
      return this._knowledgeService;
    }
    if (this._knowledgeInit) {
      return this._knowledgeInit;
    }

    this._knowledgeInit = (async () => {
      const service = new KnowledgeService();
      await service.initialize();
      this._knowledgeService = service;
      return service;
    })();

    return this._knowledgeInit;
  }

  public async getSearchService(): Promise<APISearchService> {
    if (this._searchService) {
      return this._searchService;
    }
    if (this._searchInit) {
      return this._searchInit;
    }

    this._searchInit = (async () => {
      const knowledge = await this.getKnowledgeService();
      const apiData =
        (knowledge as any).knowledgeRepository?.apiData ?? new Map();
      const service = new APISearchService();
      await service.initialize(apiData);
      this._searchService = service;
      return service;
    })();

    return this._searchInit;
  }

  public async getCodeGenerationService(): Promise<CodeGenerationService> {
    if (this._codeGenService) {
      return this._codeGenService;
    }
    if (this._codeGenInit) {
      return this._codeGenInit;
    }

    this._codeGenInit = (async () => {
      const service = new CodeGenerationService();
      await service.initialize();
      this._codeGenService = service;
      return service;
    })();

    return this._codeGenInit;
  }

  public async getSessionService(): Promise<InteractiveSessionService> {
    if (this._sessionService) {
      return this._sessionService;
    }
    if (this._sessionInit) {
      return this._sessionInit;
    }

    this._sessionInit = (async () => {
      const service = new InteractiveSessionService();
      await service.initialize();
      this._sessionService = service;
      return service;
    })();

    return this._sessionInit;
  }
}

export default ServiceManager.instance;
