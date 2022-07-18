import { context, SpanOptions, trace } from '@opentelemetry/api'

import { TransactionTracer } from '../../../utils/TransactionTracer'

export function runInActiveSpan<R>({
  name,
  callback,
  options = {},
  transactionTracer,
}: {
  name: string
  callback: () => Promise<R>
  options?: SpanOptions

  transactionTracer?: TransactionTracer
}) {
  const tracer = trace.getTracer('prisma')

  return tracer.startActiveSpan(name, options, context.active(), async (span) => {
    return callback().finally(() => {
      if (transactionTracer) {
        transactionTracer.appendChildren(span)
      }

      span.end()
    })
  })
}

export async function runInSpan<R>({
  name,
  callback,
  options = {},
}: {
  name: string
  callback: () => Promise<R>
  options?: SpanOptions
}): Promise<R> {
  const tracer = trace.getTracer('prisma')
  const span = tracer.startSpan(name, options)

  try {
    return await callback()
  } finally {
    span.end()
  }
}
