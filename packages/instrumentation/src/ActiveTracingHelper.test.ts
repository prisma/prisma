import { Tracer, TracerProvider } from '@opentelemetry/api'
import { EngineSpan, EngineTraceEvent } from '@prisma/instrumentation-contract'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { ActiveTracingHelper } from './ActiveTracingHelper'

describe('ActiveTracingHelper', () => {
  let provider: TracerProvider
  let helper: ActiveTracingHelper
  let mockSpan: any

  beforeEach(() => {
    mockSpan = {
      spanContext: () => ({
        traceId: 'trace-id',
        spanId: 'span-id',
        traceFlags: 0,
      }),
      addLinks: vi.fn(),
      addEvent: vi.fn(),
      end: vi.fn(),
    }

    const mockTracer = {
      startActiveSpan: vi.fn((name, options, callback) => {
        return callback(mockSpan)
      }),
      startSpan: vi.fn(() => mockSpan),
    } as unknown as Tracer

    provider = {
      getTracer: vi.fn(() => mockTracer),
    } as unknown as TracerProvider

    helper = new ActiveTracingHelper({ tracerProvider: provider, ignoreSpanTypes: [] })
  })

  test('dispatchEngineSpans attaches logs to spans', () => {
    const spanId = 'span-1'
    const spans: EngineSpan[] = [
      {
        id: spanId,
        parentId: null,
        name: 'test-span',
        kind: 'client',
        startTime: [0, 0],
        endTime: [1, 0],
        attributes: {},
      },
    ]

    const logs: EngineTraceEvent[] = [
      {
        spanId,
        level: 'info',
        timestamp: [0, 500],
        attributes: {
          message: 'test log message',
          foo: 'bar',
        },
      },
    ]

    helper.dispatchEngineSpans(spans, logs)

    expect(mockSpan.addEvent).toHaveBeenCalledWith('test log message', { foo: 'bar' }, [0, 500])
  })

  test('dispatchEngineSpans handles log with no message', () => {
    const spanId = 'span-1'
    const spans: EngineSpan[] = [
      {
        id: spanId,
        parentId: null,
        name: 'test-span',
        kind: 'client',
        startTime: [0, 0],
        endTime: [1, 0],
        attributes: {},
      },
    ]

    const logs: EngineTraceEvent[] = [
      {
        spanId,
        level: 'info',
        timestamp: [0, 500],
        attributes: { foo: 'bar' },
      },
    ]

    helper.dispatchEngineSpans(spans, logs)

    expect(mockSpan.addEvent).toHaveBeenCalledWith('', { foo: 'bar' }, [0, 500])
  })
})
