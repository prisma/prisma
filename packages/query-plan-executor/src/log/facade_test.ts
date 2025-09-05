import { context as otelContext } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { assertEquals } from '@std/assert'

import { debug, error, info, query, warn } from './facade.ts'
import * as logContext from './context.ts'
import { Logger } from './logger.ts'
import { CapturingSink } from './sink.ts'

// Tests are running without the built-in OpenTelemetry instrumentation in Deno,
// so we need to register a context manager manually.
otelContext.setGlobalContextManager(new AsyncLocalStorageContextManager())

Deno.test('facade functions - integration with active context', () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  logContext.withActiveLogger(logger, () => {
    debug('debug via facade', { debug: true })
    query('query via facade', { sql: 'SELECT 1' })
    info('info via facade', { user: 'test' })
    warn('warn via facade', { warning: true })
    error('error via facade', { error: 'test error' })
  })

  // Verify logs were written to the sink
  assertEquals(sink.events.length, 5)

  // Check debug message
  assertEquals(sink.events[0].level, 'debug')
  assertEquals(sink.events[0].message, 'debug via facade')
  assertEquals(sink.events[0].attributes.debug, true)

  // Check query message
  assertEquals(sink.events[1].level, 'query')
  assertEquals(sink.events[1].message, 'query via facade')
  assertEquals(sink.events[1].attributes.sql, 'SELECT 1')

  // Check info message
  assertEquals(sink.events[2].level, 'info')
  assertEquals(sink.events[2].message, 'info via facade')
  assertEquals(sink.events[2].attributes.user, 'test')

  // Check warn message
  assertEquals(sink.events[3].level, 'warn')
  assertEquals(sink.events[3].message, 'warn via facade')
  assertEquals(sink.events[3].attributes.warning, true)

  // Check error message
  assertEquals(sink.events[4].level, 'error')
  assertEquals(sink.events[4].message, 'error via facade')
  assertEquals(sink.events[4].attributes.error, 'test error')
})
