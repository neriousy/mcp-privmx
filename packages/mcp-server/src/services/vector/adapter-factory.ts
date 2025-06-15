import { VectorStoreAdapter } from './vector-adapter.js';
import { QdrantVectorAdapter } from './qdrant-adapter.js';

// Future: import other adapters (e.g., PineconeVectorAdapter) here

export function createVectorAdapter(): VectorStoreAdapter {
  const backend = (process.env.VECTOR_BACKEND || 'qdrant').toLowerCase();

  switch (backend) {
    case 'qdrant':
      return new QdrantVectorAdapter();
    // case 'pinecone':
    //   return new PineconeVectorAdapter();
    default:
      console.warn(
        `Unknown VECTOR_BACKEND="${backend}". Falling back to Qdrant.`
      );
      return new QdrantVectorAdapter();
  }
}
