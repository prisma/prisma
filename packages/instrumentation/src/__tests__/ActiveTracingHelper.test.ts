import { trace } from '@opentelemetry/api'
import { Span } from '@opentelemetry/sdk-trace-base'
import { EngineSpan } from '@prisma/internals'

import { ActiveTracingHelper } from '../ActiveTracingHelper'

jest.mock('@opentelemetry/sdk-trace-base')

describe('ActiveTracingHelper', () => {
  // Sample test data for options used in the constructor
  const options = {
    traceMiddleware: true,
    tracerProvider: trace.getTracerProvider(),
    ignoreLayersTypes: ['prisma:client:serialize', 'prisma:engine:serialize'],
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
      const engineSpans: EngineSpan[] = [
        {
          name: 'TypeC',
          id: '456',
          parentId: '789',
          startTime: [1, 2],
          endTime: [3, 4],
          kind: 'client',
          attributes: {
            foo: 'bar',
          },
        },
      ]
      helper.dispatchEngineSpans(engineSpans)

      expect(spanEndSpyOn).toHaveBeenCalledTimes(1)
      expect(spanSetAttributesSpyOn).toHaveBeenCalledTimes(1)
      expect(spanSetAttributesSpyOn).toHaveBeenCalledWith(engineSpans[0].attributes)
    })

    it('should not create span for ignoredLayers and call the end method', () => {
      const spanEndSpyOn = jest.spyOn(Span.prototype, 'end')
      const spanSetAttributesSpyOn = jest.spyOn(Span.prototype, 'setAttributes')
      const ignoredLayers = ['prisma:client:serialize', 'prisma:engine:serialize']

      const helper = new ActiveTracingHelper({
        traceMiddleware: false,
        tracerProvider: trace.getTracerProvider(),
        ignoreLayersTypes: ignoredLayers,
      })

      const engineSpans: EngineSpan[] = [
        {
          name: 'prisma:client:serialize',
          id: '456',
          parentId: '789',
          startTime: [1, 2],
          endTime: [3, 4],
          kind: 'client',
          attributes: {
            foo: 'bar',
          },
        },
        {
          name: 'prisma:engine:serialize',
          id: '7',
          parentId: '789',
          startTime: [1, 2],
          endTime: [3, 4],
          kind: 'client',
          attributes: {
            foo: 'bar',
          },
        },
      ]
      helper.dispatchEngineSpans(engineSpans)

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
          tracerProvider: trace.getTracerProvider(),
          ignoreLayersTypes: ['prisma:engine:connection', 'prisma:engine:serialize'],
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
        tracerProvider: trace.getTracerProvider(),
        ignoreLayersTypes: ['prisma:client:operations', 'prisma:client:serialize'],
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
