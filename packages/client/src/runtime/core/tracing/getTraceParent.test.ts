import { getTracingHelper } from './TracingHelper'

it('should return 00 traceparent when tracing is disabled', () => {
  const helper = getTracingHelper([])

  const result = helper.getTraceParent()

  const [ending] = result.split('-').reverse()

  expect(ending).toEqual('00')
})
