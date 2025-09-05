import { assertEquals, assertThrows } from '@std/assert'

import { ExportableSpanId, NULL_SPAN_ID, NULL_TRACE_ID, parseSpanId, parseTraceId } from './id.ts'

Deno.test('parseTraceId - parses valid trace ID', () => {
  const validTraceId = '12345678901234567890123456789012'
  const result = parseTraceId(validTraceId)
  assertEquals(result, validTraceId)
})

Deno.test('parseTraceId - throws on invalid trace ID', () => {
  // Too short
  assertThrows(() => parseTraceId('123456'), Error, 'Invalid trace ID')

  // Too long
  assertThrows(() => parseTraceId('1234567890123456789012345678901234'), Error, 'Invalid trace ID')
})

Deno.test('parseSpanId - parses valid span ID', () => {
  const validSpanId = '1234567890123456'
  const result = parseSpanId(validSpanId)
  assertEquals(result, validSpanId)
})

Deno.test('parseSpanId - throws on invalid span ID', () => {
  // Too short
  assertThrows(() => parseSpanId('123456'), Error, 'Invalid span ID')

  // Too long
  assertThrows(() => parseSpanId('12345678901234567890'), Error, 'Invalid span ID')
})

Deno.test('NULL_TRACE_ID - has correct length', () => {
  assertEquals(NULL_TRACE_ID.length, 32)
  assertEquals(NULL_TRACE_ID, '00000000000000000000000000000000')
})

Deno.test('NULL_SPAN_ID - has correct length', () => {
  assertEquals(NULL_SPAN_ID.length, 16)
  assertEquals(NULL_SPAN_ID, '0000000000000000')
})

Deno.test('ExportableSpanId - can be constructed from valid trace and span IDs', () => {
  const traceId = parseTraceId('12345678901234567890123456789012')
  const spanId = parseSpanId('1234567890123456')

  const exportableId: ExportableSpanId = `${traceId}-${spanId}`
  assertEquals(exportableId, '12345678901234567890123456789012-1234567890123456')
})
