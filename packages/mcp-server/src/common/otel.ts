import { context, trace, SpanStatusCode } from '@opentelemetry/api';

const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

// Lazy-initialised OpenTelemetry NodeSDK instance
let _initialized = false;

async function initOpenTelemetry(): Promise<void> {
  if (!OTEL_ENABLED || _initialized) return;

  try {
    // If a real tracer provider is already registered (e.g. by Next.js @vercel/otel), skip creating a new one
    const globalProvider = trace.getTracerProvider();
    const providerName = (globalProvider as any)?.constructor?.name;
    if (providerName && providerName !== 'ProxyTracerProvider') {
      _initialized = true;
      return; // another framework already set up OpenTelemetry
    }

    // Dynamic imports keep heavyweight optional deps out of the production bundle

    // Select exporter based on env
    const exporterType = process.env.OTEL_EXPORTER ?? 'otlp';
    let traceExporter: any;

    if (exporterType === 'jaeger') {
      // Avoid bundling Jaeger exporter to prevent missing thrift asset in Next.js
      const { JaegerExporter } = await import(
        /* webpackIgnore: true */ '@opentelemetry/exporter-jaeger'
      );
      traceExporter = new JaegerExporter({
        endpoint:
          process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      });
    } else {
      // Default to OTLP/HTTP
      const { OTLPTraceExporter } = await import(
        '@opentelemetry/exporter-trace-otlp-http'
      );
      traceExporter = new OTLPTraceExporter({
        url: process.env.OTLP_ENDPOINT, // Can be undefined to use default
      });
    }

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import(
      '@opentelemetry/auto-instrumentations-node'
    );

    const sdk = new NodeSDK({
      traceExporter,
      serviceName: process.env.OTEL_SERVICE_NAME || 'privmx-mcp',
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-winston': { enabled: false },
        }),
      ],
    });

    await sdk.start();
    _initialized = true;
    console.log('🛰️  OpenTelemetry tracing initialized');
  } catch (err) {
    console.warn('Failed to initialize OpenTelemetry:', err);
  }
}

// Kick off initialisation asynchronously without blocking module load

initOpenTelemetry();

export function startSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!OTEL_ENABLED) return fn();

  const tracer = trace.getTracer('privmx-mcp');
  const span = tracer.startSpan(name);

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function setSpanAttributes(attrs: Record<string, unknown>): void {
  if (!OTEL_ENABLED) return;
  const span = trace.getActiveSpan();
  if (!span) return;
  for (const [k, v] of Object.entries(attrs)) {
    span.setAttribute(k, v as any);
  }
}
