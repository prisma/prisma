import { assertEquals } from '@std/assert'

import { ExtendedSpanOptions, normalizeSpanOptions } from './options.ts'

Deno.test('normalizeSpanOptions - converts string to options object', () => {
  const result = normalizeSpanOptions('test-span')
  assertEquals(result, { name: 'test-span' })
})

Deno.test('normalizeSpanOptions - passes through options object', () => {
  const options: ExtendedSpanOptions = {
    name: 'test-span',
    attributes: { 'test.attr': 'value' },
  }

  const result = normalizeSpanOptions(options)
  assertEquals(result, options)
})
