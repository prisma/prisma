import { assertEquals, assertThrows } from '@std/assert'

import { parseDuration } from './duration.ts'

Deno.test('ISO 8601 format', () => {
  assertEquals(
    parseDuration('P3DT2H'),
    Temporal.Duration.from({
      days: 3,
      hours: 2,
    }),
  )
})

Deno.test('milliseconds format', () => {
  assertEquals(parseDuration('1000'), Temporal.Duration.from({ milliseconds: 1000 }))
  assertEquals(parseDuration('0'), Temporal.Duration.from({ milliseconds: 0 }))
})

Deno.test('invalid format', () => {
  assertThrows(() => parseDuration(''), Error)
  assertThrows(() => parseDuration('10m'), Error)
})
