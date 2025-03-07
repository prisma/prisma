import { type TracingHelper, version } from '@prisma/internals'

import { getTracingHelper } from './TracingHelper'

const majorVersion = version.split('.')[0]

function createMockTracingHelper(): TracingHelper {
  return {
    dispatchEngineSpans: jest.fn(),
    getActiveContext: jest.fn(),
    getTraceParent: jest.fn(),
    isEnabled: jest.fn(() => true),
    runInChildSpan: jest.fn(),
  }
}

describe('DynamicTracingHelper', () => {
  it('should return 00 traceparent when tracing is disabled', () => {
    const helper = getTracingHelper()

    const result = helper.getTraceParent()

    const [ending] = result.split('-').reverse()

    expect(ending).toEqual('00')
  })

  it('picks up the fallback tracing helper', () => {
    const mockTracingHelper = createMockTracingHelper()
    globalThis.PRISMA_INSTRUMENTATION = {
      helper: mockTracingHelper,
    }

    getTracingHelper().isEnabled()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockTracingHelper.isEnabled).toHaveBeenCalledTimes(1)
  })

  it('picks up the versioned tracing helper', () => {
    const mockTracingHelper = createMockTracingHelper()
    globalThis[`V${majorVersion}_PRISMA_INSTRUMENTATION`] = {
      helper: mockTracingHelper,
    }

    getTracingHelper().isEnabled()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockTracingHelper.isEnabled).toHaveBeenCalledTimes(1)
  })

  it('prefers the versioned tracing helper over the fallback helper', () => {
    const mockVersionedTracingHelper = createMockTracingHelper()
    const mockFallbackTracingHelper = createMockTracingHelper()

    globalThis[`V${majorVersion}_PRISMA_INSTRUMENTATION`] = {
      helper: mockVersionedTracingHelper,
    }
    globalThis.PRISMA_INSTRUMENTATION = {
      helper: mockFallbackTracingHelper,
    }

    getTracingHelper().isEnabled()

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockVersionedTracingHelper.isEnabled).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockFallbackTracingHelper.isEnabled).not.toHaveBeenCalled()
  })
})
