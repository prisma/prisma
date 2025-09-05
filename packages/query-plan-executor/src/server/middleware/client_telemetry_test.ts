import { assertEquals, assertThrows } from '@std/assert'
import { parseClientTelemetryHeader } from './client_telemetry.ts'

Deno.test('parseClientTelemetryHeader - empty', () => {
  assertEquals(parseClientTelemetryHeader(''), {
    spans: false,
    logLevels: [],
  })
})

Deno.test('parseClientTelemetryHeader - spans', () => {
  assertEquals(parseClientTelemetryHeader('spans'), {
    spans: true,
    logLevels: [],
  })
})

Deno.test('parseClientTelemetryHeader - all log levels', () => {
  assertEquals(parseClientTelemetryHeader('debug,query,info,warn,error'), {
    spans: false,
    logLevels: ['debug', 'query', 'info', 'warn', 'error'],
  })

  assertEquals(parseClientTelemetryHeader('debug, query, info, warn, error'), {
    spans: false,
    logLevels: ['debug', 'query', 'info', 'warn', 'error'],
  })
})

Deno.test('parseClientTelemetryHeader - mixed', () => {
  assertEquals(parseClientTelemetryHeader('info, spans'), {
    spans: true,
    logLevels: ['info'],
  })

  assertEquals(parseClientTelemetryHeader('spans,info, warn,error'), {
    spans: true,
    logLevels: ['info', 'warn', 'error'],
  })
})

Deno.test('parseClientTelemetryHeader - invalid levels', () => {
  assertThrows(() => parseClientTelemetryHeader('invalid'), Error)
  assertThrows(() => parseClientTelemetryHeader('invalid, info'), Error)
  assertThrows(() => parseClientTelemetryHeader('spans, invalid'), Error)
})
