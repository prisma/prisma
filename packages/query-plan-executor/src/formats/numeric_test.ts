import { assertEquals, assertThrows } from '@std/assert'

import { parseInteger } from './numeric.ts'

Deno.test('valid integers', () => {
  assertEquals(parseInteger('0'), 0)
  assertEquals(parseInteger('1'), 1)
  assertEquals(parseInteger('123'), 123)
  assertEquals(parseInteger('-456'), -456)
  assertEquals(parseInteger('999999999'), 999999999)
})

Deno.test('invalid inputs', () => {
  assertThrows(() => parseInteger(''), Error)
  assertThrows(() => parseInteger('abc'), Error)
  assertThrows(() => parseInteger('123.45'), Error)
  assertThrows(() => parseInteger('123abc'), Error)
  assertThrows(() => parseInteger(' 123'), Error)
  assertThrows(() => parseInteger('123 '), Error)
  assertThrows(() => parseInteger('0x10'), Error)
})
