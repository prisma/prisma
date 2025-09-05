import { assertEquals, assertThrows } from '@std/assert'

import { parseLogLevel } from './log_level.ts'

Deno.test('parseLogLevel - valid', () => {
  assertEquals(parseLogLevel('debug'), 'debug')
  assertEquals(parseLogLevel('info'), 'info')
  assertEquals(parseLogLevel('warn'), 'warn')
  assertEquals(parseLogLevel('error'), 'error')
})

Deno.test('parseLogLevel - invalid', () => {
  assertThrows(() => parseLogLevel('invalid'), Error)
  assertThrows(() => parseLogLevel('DEBUG'), Error)
})
