import { Span, trace } from '@opentelemetry/api'

import denoJson from '../deno.json' with { type: 'json' }
import { ExtendedSpanOptions, normalizeSpanOptions } from './options.ts'
import { extractErrorFromUnknown } from '../utils/error.ts'

const clientEngineRuntimeVersion = denoJson.imports['@prisma/client-engine-runtime'].match(
  /^npm:@prisma\/client-engine-runtime@(\d+\.\d+\.\d+)$/,
)?.[1]

if (clientEngineRuntimeVersion === '0.0.0') {
  throw new Error('Cannot determine the exact client engine runtime version from deno.json')
}

export const tracer = trace.getTracer('query-plan-executor', clientEngineRuntimeVersion)

export function runInActiveSpan<R>(
  nameOrOptions: string | ExtendedSpanOptions,
  fn: (span: Span) => Promise<R>,
): Promise<R> {
  const options = normalizeSpanOptions(nameOrOptions)

  return tracer.startActiveSpan(options.name, options, async (span) => {
    try {
      return await fn(span)
    } catch (error) {
      span.recordException(extractErrorFromUnknown(error))
      throw error
    } finally {
      span.end()
    }
  })
}
