import { describe, expect, it } from 'vitest'

import { omit } from './omit'

describe('omit', () => {
  it('should remove specified keys from an object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    const result = omit(obj, ['a', 'c'])

    expect(result).toEqual({ b: 2 })
    expect(result).not.toHaveProperty('a')
    expect(result).not.toHaveProperty('c')
  })

  it('should return the original object when no keys are provided', () => {
    const obj = { a: 1, b: 2, c: 3 }
    const result = omit(obj, [])

    expect(result).toEqual(obj)
  })

  it('should handle when keys to omit do not exist in the object', () => {
    const obj: Record<string, number> = { a: 1, b: 2 }
    const result = omit(obj, ['c'])

    expect(result).toEqual(obj)
  })

  it('should work with complex object values', () => {
    const obj = {
      a: { nested: true },
      b: [1, 2, 3],
      c: 'string',
      d: null,
    }

    const result = omit(obj, ['b', 'd'])

    expect(result).toEqual({
      a: { nested: true },
      c: 'string',
    })
  })

  it('should preserve the reference of non-primitive values', () => {
    const nestedObj = { nested: true }
    const obj = { a: nestedObj, b: 2 }

    const result = omit(obj, ['b'])

    expect(result.a).toBe(nestedObj)
  })

  it('should handle empty objects', () => {
    const obj: Record<string, unknown> = {}
    const result = omit(obj, ['a'])

    expect(result).toEqual({})
  })
})
