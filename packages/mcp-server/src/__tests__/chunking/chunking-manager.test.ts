/**
 * Tests for ChunkingManager
 */

import { ChunkingManager } from '../../chunking/chunking-manager.js';
import { MethodLevelStrategy } from '../../chunking/strategies/method-level-strategy.js';
import { ContextAwareStrategy } from '../../chunking/strategies/context-aware-strategy.js';
import { HierarchicalStrategy } from '../../chunking/strategies/hierarchical-strategy.js';
import { HybridStrategy } from '../../chunking/strategies/hybrid-strategy.js';
import type { ParsedContent } from '@privmx/shared';

describe('ChunkingManager', () => {
  let chunkingManager: ChunkingManager;

  beforeEach(() => {
    chunkingManager = new ChunkingManager();

    // Register strategies
    chunkingManager.registerStrategy('method-level', new MethodLevelStrategy());
    chunkingManager.registerStrategy(
      'context-aware',
      new ContextAwareStrategy()
    );
    chunkingManager.registerStrategy(
      'hierarchical',
      new HierarchicalStrategy()
    );
    chunkingManager.registerStrategy('hybrid', new HybridStrategy());
  });

  describe('Strategy Registration', () => {
    it('should register strategies correctly', () => {
      const strategies = chunkingManager.getAvailableStrategies();
      expect(strategies).toContain('method-level');
      expect(strategies).toContain('context-aware');
      expect(strategies).toContain('hierarchical');
      expect(strategies).toContain('hybrid');
    });

    it('should allow registering custom strategies', () => {
      const customStrategy = {
        name: 'custom',
        shouldSplit: () => false,
        splitLogic: (content: ParsedContent) => [],
      };

      chunkingManager.registerStrategy('custom', customStrategy);
      const strategies = chunkingManager.getAvailableStrategies();
      expect(strategies).toContain('custom');
    });
  });

  describe('Content Processing', () => {
    const sampleContent: ParsedContent[] = [
      {
        name: 'TestMethod',
        description: 'A test method for demonstration',
        content: 'This is a test method that does something useful.',
        examples: [
          {
            title: 'Basic Usage',
            explanation: 'Shows how to use the method',
            code: 'testMethod(params)',
            language: 'javascript',
          },
        ],
        parameters: [
          {
            name: 'param1',
            description: 'First parameter',
            type: { name: 'string', optional: false },
          },
        ],
        returns: [
          {
            description: 'Return value',
            type: { name: 'Promise<string>', optional: false },
          },
        ],
        metadata: {
          type: 'method',
          namespace: 'Core',
          className: 'TestClass',
          methodName: 'testMethod',
          importance: 'high',
          tags: ['test', 'method'],
          sourceFile: 'test.json',
        },
      },
    ];

    it('should process content with method-level strategy', async () => {
      const result = await chunkingManager.processContent(sampleContent, {
        strategy: 'method-level',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: false,
        optimizeChunks: false,
        validateOutput: true,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.metadata.totalInputItems).toBe(1);
      expect(result.metadata.strategy).toBe('method-level');
      expect(result.validation.isValid).toBe(true);
    });

    it('should process content with context-aware strategy', async () => {
      const result = await chunkingManager.processContent(sampleContent, {
        strategy: 'context-aware',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: false,
        optimizeChunks: false,
        validateOutput: true,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.metadata.strategy).toBe('context-aware');
      expect(result.validation.isValid).toBe(true);
    });

    it('should enhance content when requested', async () => {
      const result = await chunkingManager.processContent(sampleContent, {
        strategy: 'method-level',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: true,
        optimizeChunks: false,
        validateOutput: false,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      // Enhanced content should be longer
      const chunk = result.chunks[0];
      expect(chunk.content.length).toBeGreaterThan(
        sampleContent[0].content.length
      );
    });

    it('should optimize chunks when requested', async () => {
      const longContent: ParsedContent[] = [
        {
          ...sampleContent[0],
          content:
            'This is a very long content that should be optimized. '.repeat(
              100
            ),
        },
      ];

      const result = await chunkingManager.processContent(longContent, {
        strategy: 'method-level',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: false,
        optimizeChunks: true,
        validateOutput: false,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      result.chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(2000); // Some tolerance for optimization
      });
    });

    it('should validate chunks when requested', async () => {
      const result = await chunkingManager.processContent(sampleContent, {
        strategy: 'method-level',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: false,
        optimizeChunks: false,
        validateOutput: true,
      });

      expect(result.validation).toBeDefined();
      expect(typeof result.validation.isValid).toBe('boolean');
      expect(Array.isArray(result.validation.errors)).toBe(true);
      expect(Array.isArray(result.validation.warnings)).toBe(true);
    });

    it('should throw error for unknown strategy', async () => {
      await expect(
        chunkingManager.processContent(sampleContent, {
          strategy: 'unknown' as any,
          maxChunkSize: 1500,
          overlapSize: 200,
          enhanceContent: false,
          optimizeChunks: false,
          validateOutput: false,
        })
      ).rejects.toThrow('Unknown chunking strategy: unknown');
    });
  });

  describe('Statistics', () => {
    it('should calculate chunk statistics correctly', async () => {
      const result = await chunkingManager.processContent(
        [
          {
            name: 'Method1',
            description: 'First method',
            content: 'Short content',
            metadata: {
              type: 'method',
              namespace: 'Core',
              importance: 'high',
              tags: ['test'],
              sourceFile: 'test1.json',
            },
          },
          {
            name: 'Method2',
            description: 'Second method',
            content:
              'This is a much longer content that should affect the statistics'.repeat(
                10
              ),
            metadata: {
              type: 'class',
              namespace: 'Threads',
              importance: 'medium',
              tags: ['test'],
              sourceFile: 'test2.json',
            },
          },
        ],
        {
          strategy: 'method-level',
          maxChunkSize: 1500,
          overlapSize: 200,
          enhanceContent: false,
          optimizeChunks: false,
          validateOutput: false,
        }
      );

      const stats = chunkingManager.getChunkStatistics(result.chunks);

      expect(stats.totalChunks).toBe(result.chunks.length);
      expect(stats.averageSize).toBeGreaterThan(0);
      expect(stats.sizeDistribution).toBeDefined();
      expect(stats.typeDistribution).toBeDefined();
      expect(stats.namespaceDistribution).toBeDefined();

      // Check if distributions have values
      expect(Object.keys(stats.typeDistribution).length).toBeGreaterThan(0);
      expect(Object.keys(stats.namespaceDistribution).length).toBeGreaterThan(
        0
      );
    });
  });

  describe('Chunk ID Generation', () => {
    it('should generate unique chunk IDs', async () => {
      const result = await chunkingManager.processContent(
        [
          {
            name: 'Method1',
            description: 'First method',
            content: 'Content 1',
            metadata: {
              type: 'method',
              namespace: 'Core',
              importance: 'high',
              tags: ['test'],
              sourceFile: 'test.json',
            },
          },
          {
            name: 'Method2',
            description: 'Second method',
            content: 'Content 2',
            metadata: {
              type: 'method',
              namespace: 'Core',
              importance: 'high',
              tags: ['test'],
              sourceFile: 'test.json',
            },
          },
        ],
        {
          strategy: 'method-level',
          maxChunkSize: 1500,
          overlapSize: 200,
          enhanceContent: false,
          optimizeChunks: false,
          validateOutput: false,
        }
      );

      const chunkIds = result.chunks.map((chunk) => chunk.id);
      const uniqueIds = new Set(chunkIds);

      expect(uniqueIds.size).toBe(chunkIds.length);
    });
  });

  describe('Performance', () => {
    it('should process content within reasonable time', async () => {
      const largeContent: ParsedContent[] = Array.from(
        { length: 50 },
        (_, i) => ({
          name: `Method${i}`,
          description: `Method ${i} description`,
          content: `This is content for method ${i}. `.repeat(20),
          metadata: {
            type: 'method',
            namespace: 'Core',
            importance: 'medium',
            tags: ['performance', 'test'],
            sourceFile: `test${i}.json`,
          },
        })
      );

      const startTime = Date.now();
      const result = await chunkingManager.processContent(largeContent, {
        strategy: 'method-level',
        maxChunkSize: 1500,
        overlapSize: 200,
        enhanceContent: false,
        optimizeChunks: false,
        validateOutput: false,
      });
      const endTime = Date.now();

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });
  });
});
