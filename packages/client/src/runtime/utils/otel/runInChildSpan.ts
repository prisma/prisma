import type { Span, Tracer } from '@opentelemetry/api'
import { getChildSpan } from './getChildSpan'

export function runInChildSpan<R>(
  name: string,
  tracer: Tracer | undefined,
  parent: Span | undefined,
  cb: (child: Span | undefined) => R,
) {
  const childSpan = getChildSpan(name, tracer, parent)
  const result = cb(childSpan)

  if (result && typeof result['then'] === 'function') {
    return (result as any as Promise<unknown>).then(() => {
      childSpan?.end()

      return result
    }) as any as R
  }

  childSpan?.end()

  return result
}
