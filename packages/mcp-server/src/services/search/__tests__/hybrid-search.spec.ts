import { SearchService } from '../search-service.js';
import { APIMethod, APINamespace } from '../../../api/types.js';

describe('Hybrid Search Engine', () => {
  const apiMethod: APIMethod = {
    name: 'sendMessage',
    key: 'js.privmx.sendMessage()',
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
    functions: [apiMethod],
    constants: [],
    types: [],
    commonPatterns: [],
  } as any;

  const apiData = new Map<string, unknown>();
  apiData.set('javascript-core', [namespace]);

  it('prioritises exact lexical match', async () => {
    process.env.TEXT_ALGO = 'bm25';
    const service = new SearchService();
    await service.initialize(apiData);
    const results = await service.search('send message');
    expect(results[0].id).toContain('sendMessage');
  });

  it('works with tfidf algorithm', async () => {
    process.env.TEXT_ALGO = 'tfidf';
    const service = new SearchService();
    await service.initialize(apiData);
    const results = await service.search('send message');
    expect(results[0]).toBeDefined();
  });
});
