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
  tracer: Tracer,
  parentCtx: Context | undefined,
  cb: (child: Span | undefined) => Promise<R>,
) {
  const ctx = parentCtx ?? context.active()
  const childSpan = tracer.startSpan(name, undefined, ctx)
  const childCtx = trace.setSpan(ctx, childSpan)
  const result = await context.with(childCtx, () => cb(childSpan))

  childSpan?.end()

  return result
}
