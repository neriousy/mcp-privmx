/**
 * Tests for JSON Parser
 */

import { JSONParser } from '../../parsers/json-parser.js';

describe('JSONParser', () => {
  let parser: JSONParser;

  beforeEach(() => {
    parser = new JSONParser();
  });

  describe('Parsing JSON API Documentation', () => {
    const sampleJSON = {
      namespaces: {
        Core: {
          classes: {
            Endpoint: {
              description: 'Main endpoint class for PrivMX',
              methods: {
                setup: {
                  description: 'Setup the PrivMX library',
                  signature:
                    'static async setup(wasmUrl: string): Promise<void>',
                  parameters: [
                    {
                      name: 'wasmUrl',
                      type: 'string',
                      description: 'URL to WASM assets',
                    },
                  ],
                  returns: {
                    type: 'Promise<void>',
                    description: 'Promise that resolves when setup is complete',
                  },
                },
              },
            },
          },
        },
      },
    };

    it('should parse JSON structure correctly', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract class information', async () => {
      const result = await parser.parse(JSON.stringify(sampleJSON));

      const endpointClass = result.find(
        (item) => item.name === 'Endpoint' && item.metadata.type === 'class'
      );

      expect(endpointClass).toBeDefined();
      expect(endpointClass?.metadata.namespace).toBe('Core');
      expect(endpointClass?.description).toContain('Main endpoint class');
    });

    it('should extract method information', async () => {
      const result = await parser.parse(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item) => item.name === 'setup' && item.metadata.type === 'method'
      );

      expect(setupMethod).toBeDefined();
      expect(setupMethod?.metadata.className).toBe('Endpoint');
      expect(setupMethod?.metadata.namespace).toBe('Core');
      expect(setupMethod?.parameters).toBeDefined();
      expect(setupMethod?.parameters?.length).toBe(1);
    });

    it('should generate enhanced content', async () => {
      const result = await parser.parse(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item) => item.name === 'setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.content).toContain('Setup');
      expect(setupMethod?.content).toContain('Parameters');
      expect(setupMethod?.content).toContain('wasmUrl');
    });

    it('should set importance levels correctly', async () => {
      const result = await parser.parse(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item) => item.name === 'setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.metadata.importance).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(
        setupMethod?.metadata.importance
      );
    });

    it('should handle empty or invalid JSON', async () => {
      await expect(parser.parse('')).rejects.toThrow();
      await expect(parser.parse('invalid json')).rejects.toThrow();
      await expect(parser.parse('{}')).resolves.toBeDefined();
    });

    it('should generate proper tags', async () => {
      const result = await parser.parse(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item) => item.name === 'setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.metadata.tags).toBeDefined();
      expect(setupMethod?.metadata.tags.length).toBeGreaterThan(0);
      expect(setupMethod?.metadata.tags).toContain('setup');
    });
  });

  describe('Multiple Namespaces', () => {
    const multiNamespaceJSON = {
      namespaces: {
        Core: {
          classes: {
            Endpoint: {
              description: 'Core endpoint',
              methods: {
                setup: {
                  description: 'Setup method',
                  signature: 'setup(): void',
                },
              },
            },
          },
        },
        Threads: {
          classes: {
            ThreadApi: {
              description: 'Thread API',
              methods: {
                createThread: {
                  description: 'Create thread method',
                  signature: 'createThread(): Promise<string>',
                },
              },
            },
          },
        },
      },
    };

    it('should parse multiple namespaces', async () => {
      const result = await parser.parse(JSON.stringify(multiNamespaceJSON));

      const coreItems = result.filter(
        (item) => item.metadata.namespace === 'Core'
      );
      const threadItems = result.filter(
        (item) => item.metadata.namespace === 'Threads'
      );

      expect(coreItems.length).toBeGreaterThan(0);
      expect(threadItems.length).toBeGreaterThan(0);
    });

    it('should maintain namespace separation', async () => {
      const result = await parser.parse(JSON.stringify(multiNamespaceJSON));

      const setupMethod = result.find(
        (item) => item.name === 'setup' && item.metadata.namespace === 'Core'
      );
      const createThreadMethod = result.find(
        (item) =>
          item.name === 'createThread' && item.metadata.namespace === 'Threads'
      );

      expect(setupMethod).toBeDefined();
      expect(createThreadMethod).toBeDefined();
      expect(setupMethod?.metadata.namespace).toBe('Core');
      expect(createThreadMethod?.metadata.namespace).toBe('Threads');
    });
  });
});
