import type { Context, Span, SpanOptions } from '@opentelemetry/api'
import type { Provider } from '@prisma/driver-adapter-utils'

import { assertNever } from './utils'

export type SpanCallback<R> = (span?: Span, context?: Context) => R

export type ExtendedSpanOptions = SpanOptions & {
  name: string
}

// A smaller version of the equivalent interface from `@prisma/internals`
export interface TracingHelper {
  runInChildSpan<R>(nameOrOptions: string | ExtendedSpanOptions, callback: SpanCallback<R>): R
}

export const noopTracingHelper: TracingHelper = {
  runInChildSpan(_, callback) {
    return callback()
  },
}

export function providerToOtelSystem(provider: Provider): string {
  switch (provider) {
    case 'postgres':
      return 'postgresql'
    case 'mysql':
      return 'mysql'
    case 'sqlite':
      return 'sqlite'
    default:
      assertNever(provider, `Unknown provider: ${provider}`)
  }
}
