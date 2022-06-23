import { context, trace } from '@opentelemetry/api'

/**
 * Executes and traces a function inside of a child span.
 * @param name of the child span
 * @param cb to trace in the child span
 * @returns
 */
export async function runInChildSpan<R>(useOtel: boolean, name: string, cb: () => Promise<R>) {
  if (useOtel === false) return cb()

  const tracer = trace.getTracer('prisma')

  return tracer.startActiveSpan(name, {}, context.active(), async (span) => {
    return cb().finally(() => span.end())
  })
}
