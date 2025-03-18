import { describe, expect, it } from 'vitest'

import { uniqueBy } from './uniqueBy'

describe('uniqueBy', () => {
  it('should return an empty array when given an empty array', () => {
    expect(uniqueBy([] as string[], (item) => item)).toEqual([])
  })

  it('should return unique elements based on the hash function', () => {
    const input = [1, 2, 3, 2, 1]
    const result = uniqueBy(input, (item) => item.toString())
    expect(result).toEqual([1, 2, 3])
  })

  it('should work with objects using custom hash functions', () => {
    const input = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Charlie' }, // Duplicate id
      { id: 3, name: 'Dave' },
    ]

    const result = uniqueBy(input, (item) => item.id.toString())

    // Should keep only the first occurrence of each id
    expect(result).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Dave' },
    ])
  })

  it('should handle string inputs', () => {
    const input = ['a', 'b', 'a', 'c', 'b']
    const result = uniqueBy(input, (item) => item)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('should work with more complex hash functions', () => {
    const input = [
      { firstName: 'John', lastName: 'Doe' },
      { firstName: 'Jane', lastName: 'Doe' },
      { firstName: 'John', lastName: 'Smith' },
      { firstName: 'John', lastName: 'Doe' }, // Duplicate
    ]

    const result = uniqueBy(input, (item) => `${item.firstName}-${item.lastName}`)

    expect(result).toEqual([
      { firstName: 'John', lastName: 'Doe' },
      { firstName: 'Jane', lastName: 'Doe' },
      { firstName: 'John', lastName: 'Smith' },
    ])
  })

  it('should preserve the first occurrence when duplicates exist', () => {
    const input = [
      { id: 1, value: 'first' },
      { id: 2, value: 'second' },
      { id: 1, value: 'duplicate' },
    ]

    const result = uniqueBy(input, (item) => item.id.toString())

    expect(result).toEqual([
      { id: 1, value: 'first' },
      { id: 2, value: 'second' },
    ])

    expect(result[0].value).toBe('first')
  })
})
