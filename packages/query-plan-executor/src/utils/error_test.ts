import { assertEquals } from '@std/assert'

import { extractErrorFromUnknown } from './error.ts'

Deno.test('extractErrorFromUnknown - returns the same Error object', () => {
  const originalError = new Error('test error')
  const result = extractErrorFromUnknown(originalError)
  assertEquals(result, originalError)
})

Deno.test('extractErrorFromUnknown - converts string to string', () => {
  const result = extractErrorFromUnknown('test string')
  assertEquals(result, 'test string')
})

Deno.test('extractErrorFromUnknown - converts number to string', () => {
  const result = extractErrorFromUnknown(42)
  assertEquals(result, '42')
})

Deno.test('extractErrorFromUnknown - converts boolean to string', () => {
  const result = extractErrorFromUnknown(true)
  assertEquals(result, 'true')
})

Deno.test('extractErrorFromUnknown - converts object to string', () => {
  const testObj = { foo: 'bar' }
  const result = extractErrorFromUnknown(testObj)
  assertEquals(result, '[object Object]')
})

Deno.test('extractErrorFromUnknown - converts null to string', () => {
  const result = extractErrorFromUnknown(null)
  assertEquals(result, 'null')
})

Deno.test('extractErrorFromUnknown - converts undefined to string', () => {
  const result = extractErrorFromUnknown(undefined)
  assertEquals(result, 'undefined')
})
