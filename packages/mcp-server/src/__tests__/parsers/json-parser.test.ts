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
      Core: [
        {
          title: 'Core API',
          namespace: 'Core',
          content: [
            {
              type: 'class',
              name: 'Endpoint',
              description: 'Main endpoint class for PrivMX',
              fields: [],
              methods: [
                {
                  type: 'method',
                  name: 'setup',
                  description: 'Setup the PrivMX library',
                  snippet: 'static async setup(wasmUrl: string): Promise<void>',
                  methodType: 'static',
                  params: [
                    {
                      name: 'wasmUrl',
                      description: 'URL to WASM assets',
                      type: {
                        name: 'string',
                        optional: false,
                      },
                    },
                  ],
                  returns: [
                    {
                      type: {
                        name: 'Promise<void>',
                        optional: false,
                      },
                      description: 'Promise that resolves when setup is complete',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      _meta: {
        version: '1.0.0',
        package: 'privmx',
        lang: 'typescript',
        name: 'PrivMX API',
      },
    };

    it('should parse JSON structure correctly', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract class information', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      const endpointClass = result.find(
        (item: any) => item.name === 'Endpoint' && item.metadata.type === 'class'
      );

      expect(endpointClass).toBeDefined();
      expect(endpointClass?.metadata.namespace).toBe('Core');
      expect(endpointClass?.description).toContain('Main endpoint class');
    });

    it('should extract method information', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item: any) => item.name === 'Endpoint.setup' && item.metadata.type === 'method'
      );

      expect(setupMethod).toBeDefined();
      expect(setupMethod?.metadata.className).toBe('Endpoint');
      expect(setupMethod?.metadata.namespace).toBe('Core');
      expect(setupMethod?.parameters).toBeDefined();
      expect(setupMethod?.parameters?.length).toBe(1);
    });

    it('should generate enhanced content', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item: any) => item.name === 'Endpoint.setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.content).toContain('Setup');
      expect(setupMethod?.content).toContain('Parameters');
      expect(setupMethod?.content).toContain('wasmUrl');
    });

    it('should set importance levels correctly', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item: any) => item.name === 'Endpoint.setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.metadata.importance).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(
        setupMethod?.metadata.importance
      );
    });

    it('should handle empty or invalid JSON', async () => {
      await expect(parser.parseSpec('')).rejects.toThrow();
      await expect(parser.parseSpec('invalid json')).rejects.toThrow();
      await expect(parser.parseSpec('{"_meta": {}}')).resolves.toBeDefined();
    });

    it('should generate proper tags', async () => {
      const result = await parser.parseSpec(JSON.stringify(sampleJSON));

      const setupMethod = result.find(
        (item: any) => item.name === 'Endpoint.setup' && item.metadata.type === 'method'
      );

      expect(setupMethod?.metadata.tags).toBeDefined();
      expect(setupMethod?.metadata.tags.length).toBeGreaterThan(0);
      expect(setupMethod?.metadata.tags).toContain('setup');
    });
  });

  describe('Multiple Namespaces', () => {
    const multiNamespaceJSON = {
      Core: [
        {
          title: 'Core API',
          namespace: 'Core',
          content: [
            {
              type: 'class',
              name: 'Endpoint',
              description: 'Core endpoint',
              fields: [],
              methods: [
                {
                  type: 'method',
                  name: 'setup',
                  description: 'Setup method',
                  snippet: 'setup(): void',
                  methodType: 'static',
                  params: [],
                  returns: null,
                },
              ],
            },
          ],
        },
      ],
      Threads: [
        {
          title: 'Threads API',
          namespace: 'Threads',
          content: [
            {
              type: 'class',
              name: 'ThreadApi',
              description: 'Thread API',
              fields: [],
              methods: [
                {
                  type: 'method',
                  name: 'createThread',
                  description: 'Create thread method',
                  snippet: 'createThread(): Promise<string>',
                  methodType: 'instance',
                  params: [],
                  returns: [
                    {
                      type: {
                        name: 'Promise<string>',
                        optional: false,
                      },
                      description: 'Thread ID',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      _meta: {
        version: '1.0.0',
        package: 'privmx',
        lang: 'typescript',
        name: 'PrivMX API',
      },
    };

    it('should parse multiple namespaces', async () => {
      const result = await parser.parseSpec(JSON.stringify(multiNamespaceJSON));

      const coreItems = result.filter(
        (item: any) => item.metadata.namespace === 'Core'
      );
      const threadItems = result.filter(
        (item: any) => item.metadata.namespace === 'Threads'
      );

      expect(coreItems.length).toBeGreaterThan(0);
      expect(threadItems.length).toBeGreaterThan(0);
    });

    it('should maintain namespace separation', async () => {
      const result = await parser.parseSpec(JSON.stringify(multiNamespaceJSON));

      const setupMethod = result.find(
        (item: any) => item.name === 'Endpoint.setup' && item.metadata.namespace === 'Core'
      );
      const createThreadMethod = result.find(
        (item: any) =>
          item.name === 'ThreadApi.createThread' && item.metadata.namespace === 'Threads'
      );

      expect(setupMethod).toBeDefined();
      expect(createThreadMethod).toBeDefined();
      expect(setupMethod?.metadata.namespace).toBe('Core');
      expect(createThreadMethod?.metadata.namespace).toBe('Threads');
    });
  });
});
