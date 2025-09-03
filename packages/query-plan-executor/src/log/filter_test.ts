import { assertEquals } from '@std/assert'

import { LogEvent } from './event.ts'
import { discreteLogFilter, FilterDecision, thresholdLogFilter } from './filter.ts'

Deno.test('thresholdLogFilter - info threshold', () => {
  const filter = thresholdLogFilter('info')

  // Levels below threshold should be discarded
  assertEquals(filter(new LogEvent('debug', 'debug message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('query', 'query message')), FilterDecision.Discard)

  // Levels at or above threshold should be kept
  assertEquals(filter(new LogEvent('info', 'info message')), FilterDecision.Keep)
  assertEquals(filter(new LogEvent('warn', 'warn message')), FilterDecision.Keep)
  assertEquals(filter(new LogEvent('error', 'error message')), FilterDecision.Keep)
})

Deno.test('thresholdLogFilter - debug threshold', () => {
  const filter = thresholdLogFilter('debug')

  // All levels should be kept since debug is the lowest
  assertEquals(filter(new LogEvent('debug', 'debug message')), FilterDecision.Keep)
  assertEquals(filter(new LogEvent('query', 'query message')), FilterDecision.Keep)
  assertEquals(filter(new LogEvent('info', 'info message')), FilterDecision.Keep)
})

Deno.test('thresholdLogFilter - error threshold', () => {
  const filter = thresholdLogFilter('error')

  // Only error level should be kept
  assertEquals(filter(new LogEvent('debug', 'debug message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('info', 'info message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('error', 'error message')), FilterDecision.Keep)
})

Deno.test('discreteLogFilter - specified levels', () => {
  const filter = discreteLogFilter(['debug', 'error'])

  // Only debug and error should be kept
  assertEquals(filter(new LogEvent('debug', 'debug message')), FilterDecision.Keep)
  assertEquals(filter(new LogEvent('query', 'query message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('info', 'info message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('error', 'error message')), FilterDecision.Keep)
})

Deno.test('discreteLogFilter - empty levels array', () => {
  const filter = discreteLogFilter([])

  // All levels should be discarded
  assertEquals(filter(new LogEvent('debug', 'debug message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('info', 'info message')), FilterDecision.Discard)
  assertEquals(filter(new LogEvent('error', 'error message')), FilterDecision.Discard)
})
