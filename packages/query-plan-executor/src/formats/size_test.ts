import { assertEquals, assertThrows } from '@std/assert'

import { parseSize } from './size.ts'

Deno.test('plain bytes', () => {
  assertEquals(parseSize('0'), 0)
  assertEquals(parseSize('1'), 1)
  assertEquals(parseSize('1024'), 1024)
  assertEquals(parseSize('123456789'), 123456789)
})

Deno.test('decimal units', () => {
  assertEquals(parseSize('1KB'), 1000)
  assertEquals(parseSize('1.5KB'), 1500)
  assertEquals(parseSize('2MB'), 2 * 1000 * 1000)
  assertEquals(parseSize('3.5GB'), 3.5 * 1000 * 1000 * 1000)
  assertEquals(parseSize('2TB'), 2 * 1000 * 1000 * 1000 * 1000)
})

Deno.test('binary units', () => {
  assertEquals(parseSize('1KiB'), 1024)
  assertEquals(parseSize('1.5MiB'), 1.5 * 1024 * 1024)
  assertEquals(parseSize('2GiB'), 2 * 1024 * 1024 * 1024)
  assertEquals(parseSize('1TiB'), 1024 * 1024 * 1024 * 1024)
})

Deno.test('with whitespace', () => {
  assertEquals(parseSize('5 KB'), 5000)
  assertEquals(parseSize('10 MiB'), 10 * 1024 * 1024)
})

Deno.test('invalid formats', () => {
  assertThrows(() => parseSize(''), Error)
  assertThrows(() => parseSize('abc'), Error)
  assertThrows(() => parseSize('123abc'), Error)
  assertThrows(() => parseSize('KB'), Error)
  assertThrows(() => parseSize('5XB'), Error) // Unknown unit
  assertThrows(() => parseSize('-5KB'), Error) // Negative not supported
})
