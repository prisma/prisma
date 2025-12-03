import { SpanKind } from '@opentelemetry/api'
import { EngineSpan, EngineTraceEvent } from '@prisma/internals'
import { describe, expect, test, vi } from 'vitest'

import { ActiveTracingHelper } from '../ActiveTracingHelper'

describe('ActiveTracingHelper', () => {
  test('dispatchEngineSpans should attach logs to spans', () => {
    const mockSpan = {
      spanContext: () => ({
        traceId: 'trace-id',
        spanId: 'span-id',
        traceFlags: 0,
      }),
      addEvent: vi.fn(),
      addLinks: vi.fn(),
      end: vi.fn(),
    }

    const mockTracer = {
      startActiveSpan: vi.fn((name, options, callback) => {
        callback(mockSpan)
      }),
    }

    const mockTracerProvider = {
      getTracer: vi.fn(() => mockTracer),
    }

    const helper = new ActiveTracingHelper({
      tracerProvider: mockTracerProvider as any,
      ignoreSpanTypes: [],
    })

    const spanId = 'span-1'
    const spans: EngineSpan[] = [
      {
        id: spanId,
        parentId: null,
        name: 'test-span',
        kind: 'client',
        startTime: [0, 0],
        endTime: [1, 0],
      },
    ]

    const logs: EngineTraceEvent[] = [
      {
        spanId: spanId,
        level: 'info',
        timestamp: [0, 500],
        attributes: {
          message: 'test log message',
          foo: 'bar',
        },
      },
    ]

    helper.dispatchEngineSpans(spans, logs)

    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'test-span',
      expect.objectContaining({
        kind: SpanKind.CLIENT,
      }),
      expect.any(Function),
    )

    expect(mockSpan.addEvent).toHaveBeenCalledWith(
      'test log message',
      {
        message: 'test log message',
        foo: 'bar',
      },
      [0, 500],
    )
  })
})
