import { trace } from '@opentelemetry/api'
import { Span } from '@opentelemetry/sdk-trace-base'
import { EngineSpanEvent } from '@prisma/internals'

import { ActiveTracingHelper } from '../ActiveTracingHelper'
import { PrismaLayerType } from '../types'

jest.mock('@opentelemetry/sdk-trace-base')

describe('ActiveTracingHelper', () => {
  // Sample test data for options used in the constructor
  const options = {
    traceMiddleware: true,
    ignoreLayersTypes: [PrismaLayerType.ClientSerialize, PrismaLayerType.EngineSerialize],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isEnabled', () => {
    it('should return true', () => {
      const helper = new ActiveTracingHelper(options)
      expect(helper.isEnabled()).toBe(true)
    })
  })

  describe('createEngineSpan', () => {
    it('should create span and call the end method', () => {
      const spanEndSpyOn = jest.spyOn(Span.prototype, 'end')
      const spanSetAttributesSpyOn = jest.spyOn(Span.prototype, 'setAttributes')

      const helper = new ActiveTracingHelper(options)
      const engineSpanEvent: EngineSpanEvent = {
        spans: [
          {
            name: 'TypeC',
            trace_id: '123',
            span_id: '456',
            parent_span_id: '789',
            start_time: [1, 2],
            end_time: [3, 4],
            span: true,
            attributes: {
              foo: 'bar',
            },
          },
        ],
        span: true,
      }
      helper.createEngineSpan(engineSpanEvent)

      expect(spanEndSpyOn).toHaveBeenCalledTimes(1)
      expect(spanSetAttributesSpyOn).toHaveBeenCalledTimes(1)
      expect(spanSetAttributesSpyOn).toHaveBeenCalledWith(engineSpanEvent.spans[0].attributes)
    })

    it('should not create span for ignoredLayers and call the end method', () => {
      const spanEndSpyOn = jest.spyOn(Span.prototype, 'end')
      const spanSetAttributesSpyOn = jest.spyOn(Span.prototype, 'setAttributes')
      const ignoredLayers = [PrismaLayerType.ClientSerialize, PrismaLayerType.EngineSerialize]

      const helper = new ActiveTracingHelper({
        traceMiddleware: false,
        ignoreLayersTypes: ignoredLayers,
      })

      const engineSpanEvent: EngineSpanEvent = {
        spans: [
          {
            name: PrismaLayerType.ClientSerialize.toString(),
            trace_id: '123',
            span_id: '456',
            parent_span_id: '789',
            start_time: [1, 2],
            end_time: [3, 4],
            span: true,
            attributes: {
              foo: 'bar',
            },
          },
          {
            name: PrismaLayerType.EngineSerialize.toString(),
            trace_id: '123',
            span_id: '7',
            parent_span_id: '789',
            start_time: [1, 2],
            end_time: [3, 4],
            span: true,
            attributes: {
              foo: 'bar',
            },
          },
        ],
        span: true,
      }
      helper.createEngineSpan(engineSpanEvent)

      expect(spanEndSpyOn).toHaveBeenCalledTimes(0)
      expect(spanSetAttributesSpyOn).toHaveBeenCalledTimes(0)
    })
  })

  describe('runInChildSpan', () => {
    it.each(['operations', 'connect', 'serialize', 'transaction'])(
      'should create a new nested span for prisma:client:%s',
      async (jobName) => {
        const options = {
          traceMiddleware: true,
          ignoreLayersTypes: [PrismaLayerType.EngineConnection, PrismaLayerType.EngineSerialize],
        }
        const tracer = trace.getTracer('mocked')
        jest.spyOn(trace, 'getTracer').mockReturnValue(tracer)

        jest.spyOn(tracer, 'startActiveSpan')

        const helper = new ActiveTracingHelper(options)

        const callbackFn = jest.fn()
        await helper.runInChildSpan({ name: jobName }, callbackFn)

        expect(callbackFn).toHaveBeenCalledTimes(1)
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(tracer.startActiveSpan).toHaveBeenCalledTimes(1)
      },
    )

    it.each(['operations', 'serialize'])('should not create span for ignoredLayers ', async (jobName) => {
      const options = {
        traceMiddleware: true,
        ignoreLayersTypes: [PrismaLayerType.ClientOperations, PrismaLayerType.ClientSerialize],
      }
      const tracer = trace.getTracer('mocked')
      jest.spyOn(trace, 'getTracer').mockReturnValue(tracer)

      jest.spyOn(tracer, 'startActiveSpan')

      const helper = new ActiveTracingHelper(options)

      const callbackFn = jest.fn()
      await helper.runInChildSpan({ name: jobName }, callbackFn)

      expect(callbackFn).toHaveBeenCalledTimes(1)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tracer.startActiveSpan).toHaveBeenCalledTimes(0)
    })
  })
})
