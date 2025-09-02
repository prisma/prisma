import { describe, expect, test } from 'vitest'

import { convertDriverError } from './errors'

describe('LibSQL error handling', () => {
  test('missing error code gets defaulted to 1', () => {
    const dbError = convertDriverError({ code: '123456', message: 'An error occurred', rawCode: undefined })
    expect(dbError).toEqual({
      kind: 'sqlite',
      message: 'An error occurred',
      extendedCode: 1,
      originalMessage: 'An error occurred',
    })
  })
})
