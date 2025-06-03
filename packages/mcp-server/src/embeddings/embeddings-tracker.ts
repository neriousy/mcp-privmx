/**
 * Embeddings Tracker
 *
 * Persistent SQLite-based tracking system for embeddings generation.
 * Tracks which chunks have been embedded, prevents duplicates, and manages metadata.
 */

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DocumentChunk } from '@privmx/shared';
import type { EmbeddingResult } from './embeddings-service.js';

/**
 * Embedding tracking record
 */
export interface EmbeddingTrackingRecord {
  id: number;
  chunkId: string;
  chunkHash: string;
  embeddingId: string;
  modelName: string;
  tokensUsed: number;
  dimensions: number;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'completed' | 'failed' | 'outdated';
  errorMessage?: string;
  sourceFile: string;
  namespace: string;
  chunkType: string;
  importance: string;
}

/**
 * Tracking statistics
 */
export interface TrackingStats {
  totalChunks: number;
  embeddedChunks: number;
  pendingChunks: number;
  failedChunks: number;
  outdatedChunks: number;
  totalTokensUsed: number;
  lastUpdate: string;
  models: Record<string, number>;
  namespaces: Record<string, number>;
}

/**
 * Sync result information
 */
export interface SyncResult {
  newChunks: DocumentChunk[];
  updatedChunks: DocumentChunk[];
  unchangedChunks: DocumentChunk[];
  removedChunkIds: string[];
  summary: {
    total: number;
    new: number;
    updated: number;
    unchanged: number;
    removed: number;
  };
}

/**
 * SQLite-based embeddings tracker
 */
export class EmbeddingsTracker {
  private db: Database.Database;
  private dbPath: string;

  constructor(dataPath: string) {
    this.dbPath = path.join(dataPath, 'embeddings-tracker.db');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize the SQLite database schema
   */
  private initializeDatabase(): void {
    // Create embeddings tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id TEXT UNIQUE NOT NULL,
        chunk_hash TEXT NOT NULL,
        embedding_id TEXT,
        model_name TEXT,
        tokens_used INTEGER DEFAULT 0,
        dimensions INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'outdated')),
        error_message TEXT,
        source_file TEXT NOT NULL,
        namespace TEXT NOT NULL,
        chunk_type TEXT NOT NULL,
        importance TEXT NOT NULL
      );
    `);

    // Create indexes for efficient querying
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunk_id ON embedding_tracking(chunk_id);
      CREATE INDEX IF NOT EXISTS idx_status ON embedding_tracking(status);
      CREATE INDEX IF NOT EXISTS idx_namespace ON embedding_tracking(namespace);
      CREATE INDEX IF NOT EXISTS idx_chunk_type ON embedding_tracking(chunk_type);
      CREATE INDEX IF NOT EXISTS idx_updated_at ON embedding_tracking(updated_at);
    `);

    // Create metadata table for tracking overall stats
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracking_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    console.log(`📊 Embeddings tracker initialized: ${this.dbPath}`);
  }

  /**
   * Calculate hash for a chunk to detect changes
   */
  private calculateChunkHash(chunk: DocumentChunk): string {
    const content = {
      content: chunk.content,
      metadata: {
        type: chunk.metadata.type,
        namespace: chunk.metadata.namespace,
        className: chunk.metadata.className,
        methodName: chunk.metadata.methodName,
        sourceFile: chunk.metadata.sourceFile,
        lineNumber: chunk.metadata.lineNumber,
      },
    };
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content))
      .digest('hex');
  }

  /**
   * Sync chunks with the tracking database
   * Returns what needs to be processed
   */
  async syncChunks(chunks: DocumentChunk[]): Promise<SyncResult> {
    const now = new Date().toISOString();

    // Get existing tracking records
    const existingRecords = this.db
      .prepare(
        `
      SELECT chunk_id, chunk_hash, status 
      FROM embedding_tracking
    `
      )
      .all() as Array<{ chunk_id: string; chunk_hash: string; status: string }>;

    const existingMap = new Map(existingRecords.map((r) => [r.chunk_id, r]));
    const currentChunkIds = new Set(chunks.map((c) => c.id));

    const newChunks: DocumentChunk[] = [];
    const updatedChunks: DocumentChunk[] = [];
    const unchangedChunks: DocumentChunk[] = [];
    const removedChunkIds: string[] = [];

    // Process current chunks
    for (const chunk of chunks) {
      const chunkHash = this.calculateChunkHash(chunk);
      const existing = existingMap.get(chunk.id);

      if (!existing) {
        // New chunk
        newChunks.push(chunk);
        this.insertChunkRecord(chunk, chunkHash, now);
      } else if (existing.chunk_hash !== chunkHash) {
        // Updated chunk
        updatedChunks.push(chunk);
        this.updateChunkRecord(chunk.id, chunkHash, 'pending', now);
      } else if (existing.status === 'completed') {
        // Unchanged and already embedded
        unchangedChunks.push(chunk);
      } else {
        // Unchanged but not embedded yet (pending/failed)
        newChunks.push(chunk);
      }
    }

    // Find removed chunks
    for (const [chunkId] of existingMap) {
      if (!currentChunkIds.has(chunkId)) {
        removedChunkIds.push(chunkId);
        this.markChunkRemoved(chunkId, now);
      }
    }

    const result: SyncResult = {
      newChunks,
      updatedChunks,
      unchangedChunks,
      removedChunkIds,
      summary: {
        total: chunks.length,
        new: newChunks.length,
        updated: updatedChunks.length,
        unchanged: unchangedChunks.length,
        removed: removedChunkIds.length,
      },
    };

    console.log(
      `🔄 Sync completed: ${result.summary.new} new, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged, ${result.summary.removed} removed`
    );

    return result;
  }

  /**
   * Insert a new chunk tracking record
   */
  private insertChunkRecord(
    chunk: DocumentChunk,
    chunkHash: string,
    timestamp: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO embedding_tracking (
        chunk_id, chunk_hash, created_at, updated_at, status,
        source_file, namespace, chunk_type, importance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      chunk.id,
      chunkHash,
      timestamp,
      timestamp,
      'pending',
      chunk.metadata.sourceFile,
      chunk.metadata.namespace,
      chunk.metadata.type,
      chunk.metadata.importance
    );
  }

  /**
   * Update chunk record when content changes
   */
  private updateChunkRecord(
    chunkId: string,
    chunkHash: string,
    status: string,
    timestamp: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE embedding_tracking 
      SET chunk_hash = ?, status = ?, updated_at = ?, 
          embedding_id = NULL, error_message = NULL
      WHERE chunk_id = ?
    `);

    stmt.run(chunkHash, status, timestamp, chunkId);
  }

  /**
   * Mark chunk as removed (soft delete)
   */
  private markChunkRemoved(chunkId: string, timestamp: string): void {
    const stmt = this.db.prepare(`
      UPDATE embedding_tracking 
      SET status = 'outdated', updated_at = ? 
      WHERE chunk_id = ?
    `);

    stmt.run(timestamp, chunkId);
  }

  /**
   * Mark embedding as completed
   */
  async markEmbeddingCompleted(
    chunkId: string,
    embeddingResult: EmbeddingResult
  ): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE embedding_tracking 
      SET embedding_id = ?, model_name = ?, tokens_used = ?, 
          dimensions = ?, status = 'completed', updated_at = ?, error_message = NULL
      WHERE chunk_id = ?
    `);

    stmt.run(
      embeddingResult.chunkId,
      embeddingResult.metadata.model,
      embeddingResult.metadata.tokens,
      embeddingResult.embedding.length,
      now,
      chunkId
    );
  }

  /**
   * Mark embedding as failed
   */
  async markEmbeddingFailed(
    chunkId: string,
    errorMessage: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE embedding_tracking 
      SET status = 'failed', error_message = ?, updated_at = ?
      WHERE chunk_id = ?
    `);

    stmt.run(errorMessage, now, chunkId);
  }

  /**
   * Get chunks that need embedding
   */
  getChunksNeedingEmbedding(): EmbeddingTrackingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM embedding_tracking 
      WHERE status IN ('pending', 'failed')
      ORDER BY created_at ASC
    `);

    return stmt.all().map(this.mapDbRecord);
  }

  /**
   * Get tracking statistics
   */
  getTrackingStats(): TrackingStats {
    const statusCounts = this.db
      .prepare(
        `
      SELECT status, COUNT(*) as count 
      FROM embedding_tracking 
      GROUP BY status
    `
      )
      .all() as Array<{ status: string; count: number }>;

    const tokenStats = this.db
      .prepare(
        `
      SELECT 
        SUM(tokens_used) as total_tokens,
        COUNT(*) as embedded_count
      FROM embedding_tracking 
      WHERE status = 'completed'
    `
      )
      .get() as { total_tokens: number; embedded_count: number };

    const modelStats = this.db
      .prepare(
        `
      SELECT model_name, COUNT(*) as count 
      FROM embedding_tracking 
      WHERE status = 'completed' AND model_name IS NOT NULL
      GROUP BY model_name
    `
      )
      .all() as Array<{ model_name: string; count: number }>;

    const namespaceStats = this.db
      .prepare(
        `
      SELECT namespace, COUNT(*) as count 
      FROM embedding_tracking 
      GROUP BY namespace
    `
      )
      .all() as Array<{ namespace: string; count: number }>;

    const lastUpdate = this.db
      .prepare(
        `
      SELECT updated_at 
      FROM embedding_tracking 
      ORDER BY updated_at DESC 
      LIMIT 1
    `
      )
      .get() as { updated_at: string } | undefined;

    const statusMap = statusCounts.reduce(
      (acc, { status, count }) => {
        acc[status] = count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalChunks: statusCounts.reduce((sum, { count }) => sum + count, 0),
      embeddedChunks: statusMap.completed || 0,
      pendingChunks: statusMap.pending || 0,
      failedChunks: statusMap.failed || 0,
      outdatedChunks: statusMap.outdated || 0,
      totalTokensUsed: tokenStats.total_tokens || 0,
      lastUpdate: lastUpdate?.updated_at || 'Never',
      models: modelStats.reduce(
        (acc, { model_name, count }) => {
          acc[model_name] = count;
          return acc;
        },
        {} as Record<string, number>
      ),
      namespaces: namespaceStats.reduce(
        (acc, { namespace, count }) => {
          acc[namespace] = count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Get chunks by status
   */
  getChunksByStatus(status: string): EmbeddingTrackingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM embedding_tracking 
      WHERE status = ?
      ORDER BY updated_at DESC
    `);

    return stmt.all(status).map(this.mapDbRecord);
  }

  /**
   * Check if a chunk is already embedded
   */
  isChunkEmbedded(chunkId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT status FROM embedding_tracking 
      WHERE chunk_id = ? AND status = 'completed'
    `);

    return stmt.get(chunkId) !== undefined;
  }

  /**
   * Get embedding info for a chunk
   */
  getEmbeddingInfo(chunkId: string): EmbeddingTrackingRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM embedding_tracking 
      WHERE chunk_id = ?
    `);

    const record = stmt.get(chunkId);
    return record ? this.mapDbRecord(record) : null;
  }

  /**
   * Reset failed embeddings to pending
   */
  resetFailedEmbeddings(): number {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE embedding_tracking 
      SET status = 'pending', error_message = NULL, updated_at = ?
      WHERE status = 'failed'
    `);

    const result = stmt.run(now);
    console.log(`🔄 Reset ${result.changes} failed embeddings to pending`);
    return result.changes;
  }

  /**
   * Clean up outdated records
   */
  cleanupOutdatedRecords(): number {
    const stmt = this.db.prepare(`
      DELETE FROM embedding_tracking 
      WHERE status = 'outdated'
    `);

    const result = stmt.run();
    console.log(`🧹 Cleaned up ${result.changes} outdated records`);
    return result.changes;
  }

  /**
   * Map database record to TypeScript interface
   */
  private mapDbRecord(record: any): EmbeddingTrackingRecord {
    return {
      id: record.id,
      chunkId: record.chunk_id,
      chunkHash: record.chunk_hash,
      embeddingId: record.embedding_id,
      modelName: record.model_name,
      tokensUsed: record.tokens_used,
      dimensions: record.dimensions,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      status: record.status,
      errorMessage: record.error_message,
      sourceFile: record.source_file,
      namespace: record.namespace,
      chunkType: record.chunk_type,
      importance: record.importance,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database path for external access
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * Export tracking data for backup
   */
  async exportTrackingData(outputPath: string): Promise<void> {
    const records = this.db.prepare('SELECT * FROM embedding_tracking').all();
    const metadata = this.db.prepare('SELECT * FROM tracking_metadata').all();

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      records,
      metadata,
      stats: this.getTrackingStats(),
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📤 Exported tracking data to ${outputPath}`);
  }
}
