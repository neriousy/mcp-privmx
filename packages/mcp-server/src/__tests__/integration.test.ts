/**
 * Integration Test - Basic Component Interaction
 */

import { ChunkingManager } from '../chunking/chunking-manager.js';
import { MethodLevelStrategy } from '../chunking/strategies/method-level-strategy.js';
import { JSONParser } from '../parsers/json-parser.js';

describe('Integration: Basic Component Interaction', () => {
  test('ChunkingManager can be instantiated and used', () => {
    const manager = new ChunkingManager();
    expect(manager).toBeDefined();
    expect(manager.getAvailableStrategies).toBeDefined();
  });

  test('Strategy can be registered and retrieved', () => {
    const manager = new ChunkingManager();
    const strategy = new MethodLevelStrategy();

    manager.registerStrategy('test-strategy', strategy);
    const strategies = manager.getAvailableStrategies();

    expect(strategies).toContain('test-strategy');
  });

  test('JSONParser can be instantiated', () => {
    const parser = new JSONParser();
    expect(parser).toBeDefined();
    expect(parser.parseSpec).toBeDefined();
  });

  test('Chunking strategies can be instantiated', () => {
    const methodLevel = new MethodLevelStrategy();
    expect(methodLevel.name).toBe('method-level');
    expect(methodLevel.shouldSplit).toBeDefined();
    expect(methodLevel.splitLogic).toBeDefined();
  });

  test('All imports work correctly', () => {
    // This test passes if all imports above work without throwing
    expect(true).toBe(true);
  });
});
