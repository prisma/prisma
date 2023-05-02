import { getTraceParent } from './getTraceParent'
import { TracingConfig } from './getTracingConfig'

it('should return 00 traceparent when tracing is disabled', () => {
  const tracingConfig: TracingConfig = {
    enabled: false,
    middleware: false,
  }

  const result = getTraceParent({
    tracingConfig,
  })

  const [ending] = result.split('-').reverse()

  expect(ending).toEqual('00')
})
