import { type Context, type Span, SpanKind, type SpanOptions } from '@opentelemetry/api'
import type { Provider, SqlQuery, SqlQueryable } from '@prisma/driver-adapter-utils'

import { QueryEvent } from './events'
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
    case 'sqlserver':
      return 'mssql'
    default:
      assertNever(provider, `Unknown provider: ${provider}`)
  }
}

export async function withQuerySpanAndEvent<T>({
  query,
  queryable,
  tracingHelper,
  onQuery,
  execute,
}: {
  query: SqlQuery
  queryable: SqlQueryable
  tracingHelper: TracingHelper
  onQuery?: (event: QueryEvent) => void
  execute: () => Promise<T>
}): Promise<T> {
  return await tracingHelper.runInChildSpan(
    {
      name: 'db_query',
      kind: SpanKind.CLIENT,
      attributes: {
        'db.query.text': query.sql,
        'db.system.name': providerToOtelSystem(queryable.provider),
      },
    },
    async () => {
      const timestamp = new Date()
      const startInstant = performance.now()
      const result = await execute()
      const endInstant = performance.now()

      onQuery?.({
        timestamp,
        duration: endInstant - startInstant,
        query: query.sql,
        params: query.args,
      })

      return result
    },
  )
}
