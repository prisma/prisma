import { context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { assertEquals, assertThrows } from '@std/assert'
import { delay } from '@std/async/delay'

import { getActiveLogger, withActiveLogger } from './context.ts'
import { Logger } from './logger.ts'
import { CapturingSink } from './sink.ts'

// Tests are running without the built-in OpenTelemetry instrumentation in Deno,
// so we need to register a context manager manually.
context.setGlobalContextManager(new AsyncLocalStorageContextManager())

Deno.test('withActiveLogger - sets and uses logger in context', () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  // Running without an active logger should throw
  assertThrows(() => getActiveLogger(), Error, 'No active logger found')

  // Run with an active logger
  const result = withActiveLogger(logger, () => {
    // Get the active logger and use it
    const activeLogger = getActiveLogger()
    activeLogger.info('test message')

    // Return a value to confirm it's passed through
    return 'test result'
  })

  // Check the result is returned
  assertEquals(result, 'test result')

  // Check the logger was used
  assertEquals(sink.events.length, 1)
  assertEquals(sink.events[0].message, 'test message')
})

Deno.test('withActiveLogger - sets and uses logger in context (async)', async () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  // Running without an active logger should throw
  assertThrows(() => getActiveLogger(), Error, 'No active logger found')

  // Run with an active logger
  const result = await withActiveLogger(logger, async () => {
    await delay(0)

    // Get the active logger and use it after an async operation
    const activeLogger = getActiveLogger()
    activeLogger.info('test message')

    // Return a value to confirm it's passed through
    return 'test result'
  })

  // Check the result is returned
  assertEquals(result, 'test result')

  // Check the logger was used
  assertEquals(sink.events.length, 1)
  assertEquals(sink.events[0].message, 'test message')
})

Deno.test('withActiveLogger - nesting works correctly', () => {
  const sink1 = new CapturingSink()
  const sink2 = new CapturingSink()
  const logger1 = new Logger(sink1)
  const logger2 = new Logger(sink2)

  withActiveLogger(logger1, () => {
    const active1 = getActiveLogger()
    active1.info('outer logger')

    withActiveLogger(logger2, () => {
      const active2 = getActiveLogger()
      active2.info('inner logger')
    })

    const activeAgain = getActiveLogger()
    activeAgain.warn('outer again')
  })

  // Verify messages went to the correct sinks
  assertEquals(sink1.events.length, 2)
  assertEquals(sink1.events[0].message, 'outer logger')
  assertEquals(sink1.events[1].message, 'outer again')

  assertEquals(sink2.events.length, 1)
  assertEquals(sink2.events[0].message, 'inner logger')
})
