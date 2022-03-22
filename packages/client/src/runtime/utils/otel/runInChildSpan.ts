import type { Context, Span, Tracer } from '@opentelemetry/api'
import { context, trace } from '@opentelemetry/api'

/**
 * Executes and traces a function inside of a child span.
 * @param name of the child span
 * @param parentCtx parent ctx for the child span
 * @param cb to trace in the child span
 * @returns
 */
export async function runInChildSpan<R>(
  name: string,
  parentCtx: Context | undefined,
  cb: (child: Span | undefined) => Promise<R>,
) {
  if (parentCtx === undefined) return cb(undefined)

  const tracer = trace.getTracer('prisma') // it's prisma tracing
  const childSpan = tracer.startSpan(name, undefined, parentCtx)
  const childCtx = trace.setSpan(parentCtx, childSpan)
  const result = await context.with(childCtx, () => cb(childSpan))

  childSpan?.end()

  return result
}
