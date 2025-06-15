import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { QdrantVectorStore } from '@langchain/qdrant';
import { getVectorConfig } from '../documentation/../../config/vector-config.js';
import type { APINamespace, APIMethod, APIClass } from '../../api/types.js';
import { startSpan } from '../../common/otel.js';

export interface ApiVectorSearchResult {
  id: string;
  score: number;
}

/**
 * Light-weight vector store for API methods & classes.
 * Uses the same Qdrant backend if configured, otherwise falls back to in-memory cosine search.
 */
export class ApiVectorService {
  private embeddings: OpenAIEmbeddings | null = null;
  private vectorStore: QdrantVectorStore | null = null;
  private inMemoryStore: { id: string; vector: number[] }[] = [];
  private initialized = false;

  async initialize(apiData: Map<string, unknown>): Promise<void> {
    if (this.initialized) return;

    const cfg = getVectorConfig();
    if (!cfg.openai.apiKey) {
      console.warn('OpenAI key missing – API semantic search disabled');
      return;
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: cfg.openai.apiKey,
      modelName: cfg.openai.model,
    });

    try {
      this.vectorStore = new QdrantVectorStore(this.embeddings, {
        url: cfg.qdrant.url,
        apiKey: cfg.qdrant.apiKey,
        collectionName: cfg.qdrant.collectionName + '-api',
      });
    } catch {
      // Qdrant not reachable – fallback to memory
      this.vectorStore = null;
    }

    // Build document list
    const docs: Document[] = [];
    for (const [key, ns] of apiData) {
      const [language] = key.split(':');
      const namespace = ns as unknown as APINamespace;

      // Namespace functions (may be absent in incomplete data)
      for (const fn of namespace.functions ?? []) {
        docs.push(this.methodToDoc(fn, language, namespace.name));
      }
      // Classes & methods
      for (const cls of namespace.classes ?? []) {
        docs.push(this.classToDoc(cls, language, namespace.name));
        for (const m of cls.methods ?? [])
          docs.push(this.methodToDoc(m, language, namespace.name, cls.name));
        for (const m of cls.staticMethods ?? [])
          docs.push(this.methodToDoc(m, language, namespace.name, cls.name));
      }
    }

    if (this.vectorStore) {
      await this.vectorStore.addDocuments(docs);
    } else {
      const vectors = await this.embeddings.embedDocuments(
        docs.map((d) => d.pageContent)
      );
      vectors.forEach((vector, i) => {
        this.inMemoryStore.push({ id: docs[i].metadata.id as string, vector });
      });
    }

    this.initialized = true;
  }

  private methodToDoc(
    method: APIMethod,
    lang: string,
    namespace: string,
    className?: string
  ): Document {
    const text = `${method.name} ${method.description}`;
    return new Document({
      pageContent: text,
      metadata: {
        id: method.key,
        language: lang,
        type: 'method',
        namespace,
        className,
      },
    });
  }

  private classToDoc(cls: APIClass, lang: string, namespace: string): Document {
    const description = cls.description || '';
    return new Document({
      pageContent: `${cls.name} ${description}`,
      metadata: {
        id: `class:${namespace}:${cls.name}`,
        language: lang,
        type: 'class',
        namespace,
      },
    });
  }

  async semanticSearch(
    query: string,
    limit = 10
  ): Promise<ApiVectorSearchResult[]> {
    if (!this.initialized || !this.embeddings) return [];
    return startSpan('api.semanticSearch', async () => {
      if (this.vectorStore) {
        const results = await this.vectorStore.similaritySearchWithScore(
          query,
          limit * 2
        );
        return results
          .map(([doc, score]) => ({
            id: doc.metadata.id as string,
            score: 1 - score,
          }))
          .slice(0, limit);
      }
      // in-memory cosine
      const emb = this.embeddings!;
      const qVec = await emb.embedQuery(query);
      const scored = this.inMemoryStore.map((item) => ({
        id: item.id,
        score: cosineSim(qVec, item.vector),
      }));
      return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    });
  }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-5);
}
