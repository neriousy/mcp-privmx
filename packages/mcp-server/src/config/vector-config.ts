/**
 * Vector Service Configuration
 *
 * Configuration for OpenAI embeddings and Qdrant vector database integration.
 * Supports environment variables with sensible defaults.
 */

export interface VectorConfig {
  openai: {
    apiKey?: string;
    model: string;
    batchSize: number;
    stripNewLines: boolean;
  };
  qdrant: {
    url: string;
    apiKey?: string;
    collectionName: string;
    vectorSize: number;
    distance: 'Cosine' | 'Euclid' | 'Dot';
  };
  indexing: {
    chunkSize: number;
    chunkOverlap: number;
    separators: string[];
  };
}

export const defaultVectorConfig: VectorConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    batchSize: parseInt(process.env.OPENAI_BATCH_SIZE || '512'),
    stripNewLines: true,
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION || 'privmx_documentation',
    vectorSize: 1536, // text-embedding-3-small dimension
    distance: 'Cosine',
  },
  indexing: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
    separators: ['\n\n', '\n', ' ', ''],
  },
};

/**
 * Get vector configuration with environment variable overrides
 */
export function getVectorConfig(): VectorConfig {
  return {
    ...defaultVectorConfig,
    // Allow runtime overrides
  };
}

/**
 * Validate vector configuration
 */
export function validateVectorConfig(config: VectorConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.openai.apiKey) {
    errors.push('OpenAI API key is required for vector embeddings');
  }

  if (!config.qdrant.url) {
    errors.push('Qdrant URL is required');
  }

  if (config.indexing.chunkSize <= 0) {
    errors.push('Chunk size must be positive');
  }

  if (config.indexing.chunkOverlap < 0) {
    errors.push('Chunk overlap cannot be negative');
  }

  if (config.indexing.chunkOverlap >= config.indexing.chunkSize) {
    errors.push('Chunk overlap must be less than chunk size');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get environment setup instructions
 */
export function getSetupInstructions(): string {
  return `
# Vector Service Setup Instructions

## Required Environment Variables:
export OPENAI_API_KEY="your-openai-api-key"

## Optional Environment Variables:
export QDRANT_URL="http://localhost:6333"              # Default: localhost
export QDRANT_API_KEY="your-qdrant-api-key"           # Optional for local Qdrant
export QDRANT_COLLECTION="privmx_documentation"       # Default collection name
export OPENAI_EMBEDDING_MODEL="text-embedding-3-small" # Default model
export OPENAI_BATCH_SIZE="512"                        # Default batch size
export CHUNK_SIZE="1000"                               # Default chunk size
export CHUNK_OVERLAP="200"                             # Default overlap

## Qdrant Docker Setup (if needed):
docker run -p 6333:6333 qdrant/qdrant

## Features enabled with proper setup:
✅ Semantic search with OpenAI embeddings
✅ Persistent vector storage with Qdrant
✅ Advanced filtering and similarity matching
✅ Code-aware semantic understanding
✅ Multi-language documentation search
`;
}
