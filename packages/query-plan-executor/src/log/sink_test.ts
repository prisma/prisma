import { assertEquals } from '@std/assert'
import { assertSpyCalls, spy } from '@std/testing/mock'

import { LogEvent } from './event.ts'
import { FilterDecision, LogFilter } from './filter.ts'
import { CapturingSink, CompositeSink, ConsoleSink, FilteringSink } from './sink.ts'
import { ConsoleFormatter } from './format.ts'

Deno.test('CapturingSink - captures events', () => {
  const sink = new CapturingSink()
  const event1 = new LogEvent('info', 'info message')
  const event2 = new LogEvent('error', 'error message')

  sink.write(event1)
  sink.write(event2)

  assertEquals(sink.events.length, 2)
  assertEquals(sink.events[0], event1)
  assertEquals(sink.events[1], event2)
})

Deno.test('CompositeSink - writes to all sinks', () => {
  const sink1 = new CapturingSink()
  const sink2 = new CapturingSink()
  const sink3 = new CapturingSink()

  const compositeSink = new CompositeSink(sink1, sink2, sink3)
  const event = new LogEvent('info', 'test message')

  compositeSink.write(event)

  assertEquals(sink1.events.length, 1)
  assertEquals(sink1.events[0], event)

  assertEquals(sink2.events.length, 1)
  assertEquals(sink2.events[0], event)

  assertEquals(sink3.events.length, 1)
  assertEquals(sink3.events[0], event)
})

Deno.test('FilteringSink - applies filter', () => {
  const innerSink = new CapturingSink()

  const keepFilter: LogFilter = () => FilterDecision.Keep
  const discardFilter: LogFilter = () => FilterDecision.Discard

  const keepSink = new FilteringSink(innerSink, keepFilter)
  const discardSink = new FilteringSink(innerSink, discardFilter)

  const event1 = new LogEvent('info', 'should be kept')
  const event2 = new LogEvent('info', 'should be discarded')

  keepSink.write(event1)
  assertEquals(innerSink.events.length, 1)
  assertEquals(innerSink.events[0], event1)

  discardSink.write(event2)
  assertEquals(innerSink.events.length, 1) // Still just one event
})

Deno.test('ConsoleSink - writes to console with correct log level', () => {
  const formatter: ConsoleFormatter = {
    format: (event) => [event.message],
  }
  const formatSpy = spy(formatter, 'format')

  using debugSpy = spy(console, 'debug')
  using logSpy = spy(console, 'log')
  using infoSpy = spy(console, 'info')
  using warnSpy = spy(console, 'warn')
  using errorSpy = spy(console, 'error')

  const sink = new ConsoleSink(formatter)

  // Test each log level
  sink.write(new LogEvent('debug', 'debug message'))
  sink.write(new LogEvent('query', 'query message'))
  sink.write(new LogEvent('info', 'info message'))
  sink.write(new LogEvent('warn', 'warn message'))
  sink.write(new LogEvent('error', 'error message'))

  // Verify formatter was called for each event
  assertSpyCalls(formatSpy, 5)

  // Verify console methods were called with the formatted output
  assertSpyCalls(debugSpy, 1)
  assertEquals(debugSpy.calls[0].args, ['debug message'])

  assertSpyCalls(logSpy, 1)
  assertEquals(logSpy.calls[0].args, ['query message'])

  assertSpyCalls(infoSpy, 1)
  assertEquals(infoSpy.calls[0].args, ['info message'])

  assertSpyCalls(warnSpy, 1)
  assertEquals(warnSpy.calls[0].args, ['warn message'])

  assertSpyCalls(errorSpy, 1)
  assertEquals(errorSpy.calls[0].args, ['error message'])
})
