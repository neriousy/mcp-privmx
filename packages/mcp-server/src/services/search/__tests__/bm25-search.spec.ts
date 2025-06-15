import { SearchEngine } from '../core-search-engine.js';
import { APINamespace, APIMethod } from '../../../api/types.js';

describe('BM25 SearchEngine', () => {
  const originalEnv = process.env.USE_BM25;
  beforeAll(() => {
    process.env.USE_BM25 = 'true';
  });

  afterAll(() => {
    if (originalEnv !== undefined) process.env.USE_BM25 = originalEnv;
    else delete process.env.USE_BM25;
  });

  it('returns results for simple query', () => {
    const engine = new SearchEngine();

    const sendMessageMethod: APIMethod = {
      name: 'sendMessage',
      key: 'js:privmx:sendMessage()',
      description: 'Send a message to a thread',
      snippet: '',
      methodType: 'method',
      parameters: [],
      returns: [],
      language: 'javascript',
      namespace: 'privmx',
      examples: [],
      prerequisites: [],
      relatedMethods: [],
      usagePatterns: [],
    } as any;

    const namespace: APINamespace = {
      name: 'privmx',
      description: 'PrivMX core namespace',
      language: 'javascript',
      classes: [],
      functions: [sendMessageMethod],
      constants: [],
      types: [],
      commonPatterns: [],
    } as any;

    engine.addNamespace(namespace, 'javascript');
    engine.buildIndices();

    const results = engine.search('send message');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toContain('sendMessage');
  });
});
