import * as api from '@opentelemetry/api'
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks'
import { TraceIdRatioBasedSampler } from '@opentelemetry/core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

/** SETUP */

export function otelSetup() {
  // a context manager is required to propagate the context
  const contextManager = new AsyncHooksContextManager().enable()

  // it's for node.js for span nesting and ctx propagation
  api.context.setGlobalContextManager(contextManager)

  // a simple exporter that logs the raw data to the console
  const consoleExporter = new ConsoleSpanExporter()

  // exporter that natively works with jaeger without extras
  const otlpTraceExporter = new OTLPTraceExporter()
  // docker run --rm -d -p 13133:13133 -p 16686:16686 -p 4317:55680 jaegertracing/opentelemetry-all-in-one:latest

  // a standard provider that can run on the web and in node
  const provider = new BasicTracerProvider({
    sampler: new TraceIdRatioBasedSampler(0),
    resource: new Resource({
      // we can define some metadata about the trace resource
      [SemanticResourceAttributes.SERVICE_NAME]: 'basic-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  })

  registerInstrumentations({
    // @ts-ignore
    instrumentations: [new PrismaInstrumentation({ middleware: true })],
  })

  // a provider combines multiple exporters to send the data
  provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter))
  provider.addSpanProcessor(new SimpleSpanProcessor(otlpTraceExporter))

  // makes the provider the global tracer provider for telemetry
  provider.register()
}
