import { OpenAIEmbeddings } from '@langchain/openai';
import { EmbeddingProvider } from './embedding-provider.js';

export interface OpenAIEmbeddingProviderConfig {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  stripNewLines?: boolean;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private embeddings: OpenAIEmbeddings | null = null;
  private config: Required<OpenAIEmbeddingProviderConfig>;

  constructor(config: OpenAIEmbeddingProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'text-embedding-3-small',
      batchSize: config.batchSize ?? 512,
      stripNewLines: config.stripNewLines ?? true,
    } as Required<OpenAIEmbeddingProviderConfig>;
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key missing for embeddings provider');
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: this.config.model,
      batchSize: this.config.batchSize,
      stripNewLines: this.config.stripNewLines,
    });
  }

  private ensureReady() {
    if (!this.embeddings) {
      throw new Error('OpenAIEmbeddingProvider not initialized');
    }
  }

  async embedDocuments(
    texts: string[],
    _metadata: Record<string, unknown>[] = []
  ): Promise<number[][]> {
    this.ensureReady();
    return (this.embeddings as OpenAIEmbeddings).embedDocuments(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    this.ensureReady();
    return (this.embeddings as OpenAIEmbeddings).embedQuery(text);
  }

  getModelName(): string {
    return this.config.model;
  }
}
