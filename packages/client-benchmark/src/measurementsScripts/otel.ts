import { ExportResult, ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { AWSXRayPropagator } from '@opentelemetry/propagator-aws-xray'
import { Resource } from '@opentelemetry/resources'
import { ReadableSpan, SimpleSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export class BenchmarkSpanExporter implements SpanExporter {
  readonly results: Record<string, number> = {}
  constructor() {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      const time = hrTimeToMicroseconds(span.duration) / 1000
      if (!this.results[span.name]) {
        this.results[span.name] = time
      }
    }

    resultCallback({ code: ExportResultCode.SUCCESS })
  }

  shutdown() {
    return Promise.resolve()
  }
}

export function setupOtel(exporter, instrumentation) {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'bench',
    }),
    idGenerator: new AWSXRayIdGenerator(),
  })

  // provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter()))
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [instrumentation],
  })

  provider.register({ propagator: new AWSXRayPropagator() })
}
