import {
  collectDefaultMetrics,
  Registry,
  Histogram,
  Counter,
} from 'prom-client';

// Central registry for the whole server
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

// Histograms
export const searchDuration = new Histogram({
  name: 'privmx_search_duration_ms',
  help: 'Duration of search operations',
  labelNames: ['type'],
  buckets: [25, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

// Counters
export const searchCounter = new Counter({
  name: 'privmx_search_total',
  help: 'Total number of search operations',
  labelNames: ['type'],
  registers: [registry],
});

export const codegenDuration = new Histogram({
  name: 'privmx_codegen_duration_ms',
  help: 'Duration of code generation operations',
  labelNames: ['type'],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
  registers: [registry],
});

export const codegenCounter = new Counter({
  name: 'privmx_codegen_total',
  help: 'Total number of code generation operations',
  labelNames: ['type'],
  registers: [registry],
});

// Expose metrics via simple HTTP server (opt-in through env var METRICS_PORT)
export function initMetricsServer(
  port: number = Number(process.env.METRICS_PORT ?? 9400)
) {
  import('http').then(({ createServer }) => {
    const server = createServer(async (_req, res) => {
      if (_req.url === '/metrics') {
        const body = await registry.metrics();
        res.writeHead(200, { 'Content-Type': registry.contentType });
        res.end(body);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, () => {
      console.log(
        `📈 Prometheus metrics exposed at http://localhost:${port}/metrics`
      );
    });
  });
}
