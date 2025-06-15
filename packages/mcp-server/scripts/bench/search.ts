import { performance } from 'perf_hooks';
import { SearchService } from '../../src/services/search/search-service.js';
import type {
  APINamespace,
  APIClass,
  APIMethod,
  APIParameter,
  APIReturnType,
} from '../../src/api/types.js';

/**
 * Build a minimal in-memory API dataset for benchmarking.
 * This avoids reading large spec files and keeps the benchmark self-contained.
 */
function buildSampleAPIData(): Map<string, APINamespace> {
  const makeMethod = (name: string, description: string): APIMethod => {
    const param: APIParameter = {
      name: 'options',
      description: 'Method options',
      type: { name: 'object', optional: false },
      optional: false,
    };
    const returns: APIReturnType = {
      type: { name: 'Promise<any>', optional: false },
      description: 'Result promise',
    };

    return {
      name,
      key: `javascript.Core.Endpoint.${name}(object)`,
      description,
      snippet: `${name}(options)`,
      methodType: 'method',
      parameters: [param],
      returns: [returns],
      language: 'javascript',
      namespace: 'Core',
      className: 'Endpoint',
      prerequisites: [],
      relatedMethods: [],
      usagePatterns: [],
      examples: [],
    } as APIMethod;
  };

  const endpointClass: APIClass = {
    name: 'Endpoint',
    description: 'Core entry point for PrivMX SDK',
    namespace: 'Core',
    language: 'javascript',
    methods: [
      makeMethod('setup', 'Initialize SDK assets'),
      makeMethod('connect', 'Connect to backend'),
      makeMethod('createThreadApi', 'Create Thread API instance'),
      makeMethod('createStoreApi', 'Create Store API instance'),
    ],
    staticMethods: [],
    constructors: [],
    properties: [],
    dependencies: [],
    usedWith: [],
    creationPattern: 'Endpoint.setup()',
    commonWorkflows: [],
  } as APIClass;

  const namespace: APINamespace = {
    name: 'Core',
    description: 'Core functionality',
    language: 'javascript',
    classes: [endpointClass],
    functions: [],
    constants: [],
    types: [],
    commonPatterns: [],
  } as APINamespace;

  const data = new Map<string, APINamespace>();
  data.set('javascript-Core', namespace);
  return data;
}

async function runBenchmark(
  useBm25: boolean,
  iterations: number
): Promise<number> {
  process.env.USE_BM25 = useBm25 ? 'true' : 'false';

  const service = new SearchService();
  const apiData = buildSampleAPIData();
  await service.initialize(apiData as unknown as Map<string, unknown>);

  const queries = [
    'connect to backend',
    'create thread',
    'setup sdk',
    'thread api',
    'store api',
  ];

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const q = queries[i % queries.length];
    await service.search(q, 'javascript');
  }
  const end = performance.now();
  return end - start;
}

(async () => {
  const iterations = 1000;
  const bm25Time = await runBenchmark(true, iterations);
  const baselineTime = await runBenchmark(false, iterations);

  const improvement = ((baselineTime - bm25Time) / baselineTime) * 100;

  console.log('\n🔬 Search Benchmark Results');
  console.table([
    { Engine: 'BM25', 'Total Time (ms)': bm25Time.toFixed(2) },
    { Engine: 'Baseline', 'Total Time (ms)': baselineTime.toFixed(2) },
  ]);
  console.log(
    `🏎️  Improvement: ${improvement.toFixed(1)} % over baseline for ${iterations} iterations`
  );
})();
