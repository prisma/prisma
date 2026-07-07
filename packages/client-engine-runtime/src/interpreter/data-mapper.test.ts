import { describe, expect, test } from 'vitest'

import { ResultNode } from '../query-plan'
import { applyDataMap } from './data-mapper'

// A `findUnique` on a model with a to-many relation, loaded with the `join`
// relation load strategy, deserializes to this shape: the relation is a single
// JSON aggregate and each row is an object. Scalar list fields whose element
// type cannot be represented in JSON without loss of precision (`BigInt[]`,
// `Decimal[]`) are `::text`-cast into that aggregate by the query compiler, so
// they arrive as a PostgreSQL array literal string (e.g. `"{1,2}"`) rather than
// a JS array. See https://github.com/prisma/prisma/issues/28349.
function listFieldStructure(type: 'bigint' | 'decimal' | 'string'): ResultNode {
  return {
    type: 'object',
    serializedName: null,
    skipNulls: false,
    fields: {
      values: { type: 'field', dbName: 'values', fieldType: { arity: 'list', type } },
    },
  }
}

const enums = {}

describe('scalar list fields under the join relation load strategy', () => {
  test('parses a BigInt[] PostgreSQL array literal string into an array', () => {
    const result = applyDataMap({ values: '{1,2}' }, listFieldStructure('bigint'), enums)
    expect(result).toEqual({
      values: [
        { $type: 'BigInt', value: '1' },
        { $type: 'BigInt', value: '2' },
      ],
    })
  })

  test('parses a Decimal[] PostgreSQL array literal string into an array', () => {
    const result = applyDataMap({ values: '{1.5,2.25}' }, listFieldStructure('decimal'), enums)
    expect(result).toEqual({
      values: [
        { $type: 'Decimal', value: '1.5' },
        { $type: 'Decimal', value: '2.25' },
      ],
    })
  })

  test('parses an empty PostgreSQL array literal into an empty array', () => {
    const result = applyDataMap({ values: '{}' }, listFieldStructure('bigint'), enums)
    expect(result).toEqual({ values: [] })
  })

  test('parses quoted elements, unescaping `\\"` and `\\\\`', () => {
    const result = applyDataMap({ values: '{"a,b","c\\"d"}' }, listFieldStructure('string'), enums)
    expect(result).toEqual({ values: ['a,b', 'c"d'] })
  })

  test('still maps a value that is already a JS array (query load strategy path)', () => {
    const result = applyDataMap({ values: [1, 2] }, listFieldStructure('bigint'), enums)
    expect(result).toEqual({
      values: [
        { $type: 'BigInt', value: 1 },
        { $type: 'BigInt', value: 2 },
      ],
    })
  })

  test('a null list value maps to an empty array', () => {
    const result = applyDataMap({ values: null }, listFieldStructure('bigint'), enums)
    expect(result).toEqual({ values: [] })
  })
})
