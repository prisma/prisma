import type { Context, Span, Tracer } from '@opentelemetry/api'
import { trace, context } from '@opentelemetry/api'

/**
 * Executes and traces a function inside of a child span.
 * @param name of the child span
 * @param tracer currently tracing
 * @param parent span of the child span
 * @param cb to trace in the child span
 * @returns
 */
export async function runInChildSpan<R>(
  name: string,
  tracer: Tracer | undefined,
  parentCtx: Context | undefined,
  cb: (child: Span | undefined) => Promise<R>,
) {
  const childSpan = tracer?.startSpan(name, undefined, parentCtx)
  const childCtx = trace.setSpan(parentCtx!, childSpan!)
  const result = await context.with(childCtx, () => cb(childSpan))

  childSpan?.end()

  return result
}
