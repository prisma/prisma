import { assertEquals } from '@std/assert'

import { Logger } from './logger.ts'
import { LogLevel } from './log_level.ts'
import { CapturingSink } from './sink.ts'

Deno.test('Logger - logs messages at the correct level', () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  // Test each log level method
  logger.debug('debug message', { debug: true })
  logger.query('query message', { sql: 'SELECT 1' })
  logger.info('info message', { user: 'test' })
  logger.warn('warn message', { warning: true })
  logger.error('error message', { error: 'test error' })

  // Verify each call was captured
  assertEquals(sink.events.length, 5)

  // Check debug call
  const debugEvent = sink.events[0]
  assertEquals(debugEvent.level, 'debug')
  assertEquals(debugEvent.message, 'debug message')
  assertEquals(debugEvent.attributes.debug, true)

  // Check query call
  const queryEvent = sink.events[1]
  assertEquals(queryEvent.level, 'query')
  assertEquals(queryEvent.message, 'query message')
  assertEquals(queryEvent.attributes.sql, 'SELECT 1')

  // Check info call
  const infoEvent = sink.events[2]
  assertEquals(infoEvent.level, 'info')
  assertEquals(infoEvent.message, 'info message')
  assertEquals(infoEvent.attributes.user, 'test')

  // Check warn call
  const warnEvent = sink.events[3]
  assertEquals(warnEvent.level, 'warn')
  assertEquals(warnEvent.message, 'warn message')
  assertEquals(warnEvent.attributes.warning, true)

  // Check error call
  const errorEvent = sink.events[4]
  assertEquals(errorEvent.level, 'error')
  assertEquals(errorEvent.message, 'error message')
  assertEquals(errorEvent.attributes.error, 'test error')
})

Deno.test('Logger - generic log method', () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  // Test the generic log method with different levels
  const levels: LogLevel[] = ['debug', 'query', 'info', 'warn', 'error']

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    logger.log(level, `${level} message`, { index: i })
  }

  // Verify all events were captured
  assertEquals(sink.events.length, levels.length)

  // Check each event
  for (let i = 0; i < levels.length; i++) {
    const event = sink.events[i]
    assertEquals(event.level, levels[i])
    assertEquals(event.message, `${levels[i]} message`)
    assertEquals(event.attributes.index, i)
  }
})

Deno.test('Logger - handles undefined attributes', () => {
  const sink = new CapturingSink()
  const logger = new Logger(sink)

  // Call without attributes
  logger.info('info without attributes')

  // Verify the event has empty attributes
  assertEquals(sink.events.length, 1)
  assertEquals(Object.keys(sink.events[0].attributes).length, 0)
})
