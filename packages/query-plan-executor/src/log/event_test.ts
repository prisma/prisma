import { assertEquals, assertObjectMatch } from '@std/assert'

import { LogEvent } from './event.ts'
import { LogLevel } from './log_level.ts'

Deno.test('LogEvent construction and properties', () => {
  const event = new LogEvent('info', 'test message', { key1: 'value1' })

  assertEquals(event.level, 'info')
  assertEquals(event.message, 'test message')
  assertObjectMatch(event.attributes, { key1: 'value1' })

  // Verify timestamp is an instance of Temporal.Instant
  assertEquals(event.timestamp instanceof Temporal.Instant, true)
})

Deno.test('LogEvent export method', () => {
  const event = new LogEvent('debug', 'test debug', { debug: true })
  const exported = event.export()

  assertEquals(exported.level, 'debug')
  assertEquals(exported.message, 'test debug')
  assertObjectMatch(exported.attributes, { debug: true })

  // Verify timestamp is an HrTime tuple (number[])
  assertEquals(Array.isArray(exported.timestamp), true)
  assertEquals(exported.timestamp.length, 2)
})

Deno.test('LogEvent handles empty attributes', () => {
  const event = new LogEvent('warn', 'warning message')

  assertEquals(event.level, 'warn')
  assertEquals(event.message, 'warning message')
  assertEquals(Object.keys(event.attributes).length, 0)
})

Deno.test('LogEvent with different log levels', () => {
  const levels: LogLevel[] = ['debug', 'query', 'info', 'warn', 'error']

  for (const level of levels) {
    const event = new LogEvent(level, `${level} message`)
    assertEquals(event.level, level)
  }
})
