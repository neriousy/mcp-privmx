import { NextRequest, NextResponse } from 'next/server';
import { getServiceManager } from '../../../lib/services/service-manager';

export interface EmbeddingsStatus {
  hasEmbeddings: boolean;
  totalEmbeddings: number;
  lastUpdated: string | null;
  indexSize: string;
  configuration: {
    chunkSize: number;
    overlap: number;
    model: string;
  };
}

/**
 * GET /api/embeddings - Get embeddings status
 */
export async function GET(): Promise<NextResponse> {
  try {
    console.log('📊 [Embeddings API] Getting embeddings status...');

    const serviceManager = getServiceManager();

    // Handle uninitialized services gracefully
    if (!serviceManager.isInitialized()) {
      console.log('⚠️ [Embeddings API] Services not initialized yet');

      const status: EmbeddingsStatus = {
        hasEmbeddings: false,
        totalEmbeddings: 0,
        lastUpdated: null,
        indexSize: '0 KB',
        configuration: {
          chunkSize: 1000, // Default values
          overlap: 200,
          model: 'text-embedding-3-small',
        },
      };

      return NextResponse.json(status);
    }

    // Services are initialized, get actual status
    const knowledgeService = await serviceManager.getKnowledgeService();
    const stats = knowledgeService.getStats();
    const serviceStats = serviceManager.getStats();

    // Try to get more detailed stats if available
    let totalEmbeddings = 0;
    let indexSize = '0 KB';
    let lastUpdated: string | null = null;

    try {
      const _detailedStats = await serviceManager.getDetailedStats();
      // Use actual properties from the stats structure
      totalEmbeddings = stats.documentationStats?.totalDocuments || 0;
      lastUpdated = serviceStats.lastInitialized
        ? serviceStats.lastInitialized.toISOString()
        : null;

      // Estimate index size (this would be more accurate with actual vector service)
      if (totalEmbeddings > 0) {
        const estimatedSizeKB = Math.round(totalEmbeddings * 1.5); // Rough estimate
        indexSize =
          estimatedSizeKB > 1024
            ? `${(estimatedSizeKB / 1024).toFixed(1)} MB`
            : `${estimatedSizeKB} KB`;
      }
    } catch (error) {
      console.warn('Could not get detailed vector stats:', error);
    }

    const status: EmbeddingsStatus = {
      hasEmbeddings: totalEmbeddings > 0 && !!process.env.OPENAI_API_KEY,
      totalEmbeddings,
      lastUpdated,
      indexSize,
      configuration: {
        chunkSize: 1000, // These would come from actual service config
        overlap: 200,
        model: 'text-embedding-3-small',
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('❌ [Embeddings API] Failed to get status:', error);

    // Return a safe default status even on error
    const errorStatus: EmbeddingsStatus = {
      hasEmbeddings: false,
      totalEmbeddings: 0,
      lastUpdated: null,
      indexSize: '0 KB',
      configuration: {
        chunkSize: 1000,
        overlap: 200,
        model: 'text-embedding-3-small',
      },
    };

    return NextResponse.json(errorStatus);
  }
}

/**
 * POST /api/embeddings - Create or recreate embeddings
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { forceReindex = false } = body;

    console.log(
      `🔄 [Embeddings API] ${forceReindex ? 'Recreating' : 'Creating'} embeddings (force: ${forceReindex})`
    );

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
        },
        { status: 400 }
      );
    }

    const serviceManager = getServiceManager();

    // Initialize services if not already done
    if (!serviceManager.isInitialized()) {
      console.log(
        '🔄 [Embeddings API] Initializing services for the first time...'
      );
      await serviceManager.initializeServices();
    }

    if (forceReindex) {
      console.log(
        '🔄 [Embeddings API] Force re-initializing services for embeddings recreation...'
      );
      await serviceManager.reinitialize();
    }

    const knowledgeService = await serviceManager.getKnowledgeService();
    const stats = knowledgeService.getStats();

    return NextResponse.json({
      message: forceReindex
        ? 'Embeddings recreated successfully'
        : 'Embeddings created/updated successfully',
      stats: {
        documentsProcessed: stats.documentationStats?.totalDocuments || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [Embeddings API] Failed to create embeddings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/embeddings - Clear embeddings
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    console.log('🗑️ [Embeddings API] Clearing embeddings...');

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'Vector service not available (no OpenAI API key)',
        },
        { status: 400 }
      );
    }

    const serviceManager = getServiceManager();

    // Reset the service manager to clear embeddings
    await serviceManager.reinitialize();

    return NextResponse.json({
      message: 'Embeddings cleared and services reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Embeddings API] Failed to clear embeddings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
