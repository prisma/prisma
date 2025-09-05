import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { assertEquals } from '@std/assert'
import { assertSnapshot } from '@std/testing/snapshot'

import { LogEvent } from './event.ts'
import { createLogFormatter, JsonFormatter, TextFormatter } from './format.ts'
import { getTestTracer } from '../tracing/test_utils.ts'

// Tests are running without the built-in OpenTelemetry instrumentation in Deno,
// so we need to register a context manager manually.
context.setGlobalContextManager(new AsyncLocalStorageContextManager())

Deno.test('TextFormatter - formats debug events correctly', (test) => {
  const formatter = new TextFormatter()

  const event = new LogEvent(
    'debug',
    'test message',
    { userId: '123', method: 'GET' },
    Temporal.Instant.from('2025-04-14T00:00:00Z'),
  )

  const formatted = formatter.format(event)

  assertSnapshot(test, formatted)
})

Deno.test('TextFormatter - formats query events correctly', (test) => {
  const formatter = new TextFormatter()

  const event = new LogEvent(
    'query',
    'test message',
    { userId: '123', method: 'GET' },
    Temporal.Instant.from('2025-04-14T00:00:00Z'),
  )

  const formatted = formatter.format(event)

  assertSnapshot(test, formatted)
})

Deno.test('TextFormatter - formats info events correctly', (test) => {
  const formatter = new TextFormatter()

  const event = new LogEvent(
    'info',
    'test message',
    { userId: '123', method: 'GET' },
    Temporal.Instant.from('2025-04-14T00:00:00Z'),
  )

  const formatted = formatter.format(event)

  assertSnapshot(test, formatted)
})

Deno.test('TextFormatter - formats warn events correctly', (test) => {
  const formatter = new TextFormatter()

  const event = new LogEvent(
    'warn',
    'test message',
    { userId: '123', method: 'GET' },
    Temporal.Instant.from('2025-04-14T00:00:00Z'),
  )

  const formatted = formatter.format(event)

  assertSnapshot(test, formatted)
})

Deno.test('TextFormatter - formats error events correctly', (test) => {
  const formatter = new TextFormatter()

  const event = new LogEvent(
    'error',
    'test message',
    { userId: '123', method: 'GET' },
    Temporal.Instant.from('2025-04-14T00:00:00Z'),
  )

  const formatted = formatter.format(event)

  assertSnapshot(test, formatted)
})

Deno.test('JsonFormatter - formats log events as JSON', (test) => {
  // Set up OpenTelemetry to test that we store the trace ID and span ID in the
  // log event and output them in the formatted JSON.
  const tracer = getTestTracer()

  tracer.startActiveSpan('test', () => {
    const formatter = new JsonFormatter()

    const event = new LogEvent('error', 'error message', { code: 500 }, Temporal.Instant.from('2025-04-14T00:00:00Z'))

    const formatted = formatter.format(event)

    assertSnapshot(test, formatted)

    // Parse the JSON to verify it is valid
    const jsonStr = formatted[1] as string
    const parsed = JSON.parse(jsonStr)
    assertEquals(parsed.message, 'error message')
  })
})

Deno.test('createLogFormatter - returns correct formatter', () => {
  const textFormatter = createLogFormatter('text')
  const jsonFormatter = createLogFormatter('json')

  assertEquals(textFormatter instanceof TextFormatter, true)
  assertEquals(jsonFormatter instanceof JsonFormatter, true)
})
