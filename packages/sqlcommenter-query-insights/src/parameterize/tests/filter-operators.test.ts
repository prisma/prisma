import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - filter operators', () => {
  describe('equality operators', () => {
    it('parameterizes equals operator value', () => {
      const query = {
        arguments: {
          where: {
            email: { equals: 'user@example.com' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            email: { equals: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes not operator with value', () => {
      const query = {
        arguments: {
          where: {
            email: { not: 'admin@example.com' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            email: { not: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes not operator with nested object', () => {
      const query = {
        arguments: {
          where: {
            email: { not: { equals: 'admin@example.com' } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            email: { not: { equals: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('list operators', () => {
    it('parameterizes in operator array', () => {
      const query = {
        arguments: {
          where: {
            status: { in: ['ACTIVE', 'PENDING'] },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            status: { in: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER] },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes notIn operator array', () => {
      const query = {
        arguments: {
          where: {
            status: { notIn: ['DELETED', 'ARCHIVED'] },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            status: { notIn: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER] },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('comparison operators', () => {
    it('parameterizes lt operator', () => {
      const query = {
        arguments: {
          where: {
            age: { lt: 18 },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            age: { lt: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes lte operator', () => {
      const query = {
        arguments: {
          where: {
            age: { lte: 17 },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            age: { lte: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes gt operator', () => {
      const query = {
        arguments: {
          where: {
            age: { gt: 65 },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            age: { gt: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes gte operator', () => {
      const query = {
        arguments: {
          where: {
            age: { gte: 66 },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            age: { gte: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes multiple comparison operators together', () => {
      const query = {
        arguments: {
          where: {
            age: { lt: 18, lte: 17, gt: 65, gte: 66 },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            age: {
              lt: PARAM_PLACEHOLDER,
              lte: PARAM_PLACEHOLDER,
              gt: PARAM_PLACEHOLDER,
              gte: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('string operators', () => {
    it('parameterizes contains operator', () => {
      const query = {
        arguments: {
          where: {
            name: { contains: 'John' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            name: { contains: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes startsWith operator', () => {
      const query = {
        arguments: {
          where: {
            name: { startsWith: 'J' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            name: { startsWith: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes endsWith operator', () => {
      const query = {
        arguments: {
          where: {
            name: { endsWith: 'n' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            name: { endsWith: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes all string operators together', () => {
      const query = {
        arguments: {
          where: {
            name: { contains: 'John', startsWith: 'J', endsWith: 'n' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            name: {
              contains: PARAM_PLACEHOLDER,
              startsWith: PARAM_PLACEHOLDER,
              endsWith: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes search operator (full-text search)', () => {
      const query = {
        arguments: {
          where: {
            content: { search: 'prisma database' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            content: { search: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('preserves mode operator (structural enum)', () => {
      const query = {
        arguments: {
          where: {
            name: { contains: 'john', mode: 'insensitive' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            name: { contains: PARAM_PLACEHOLDER, mode: 'insensitive' },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('array field operators', () => {
    it('parameterizes has operator', () => {
      const query = {
        arguments: {
          where: {
            tags: { has: 'typescript' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            tags: { has: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes hasEvery operator', () => {
      const query = {
        arguments: {
          where: {
            tags: { hasEvery: ['typescript', 'prisma'] },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            tags: { hasEvery: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER] },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes hasSome operator', () => {
      const query = {
        arguments: {
          where: {
            tags: { hasSome: ['typescript', 'javascript'] },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            tags: { hasSome: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER] },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes isEmpty operator', () => {
      const query = {
        arguments: {
          where: {
            tags: { isEmpty: true },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            tags: { isEmpty: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('JSON operators', () => {
    it('parameterizes path operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { path: ['nested', 'field'], equals: 'value' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: {
              path: [PARAM_PLACEHOLDER, PARAM_PLACEHOLDER],
              equals: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes string_contains operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { string_contains: 'search term' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { string_contains: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes string_starts_with operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { string_starts_with: 'prefix' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { string_starts_with: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes string_ends_with operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { string_ends_with: 'suffix' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { string_ends_with: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes array_contains operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { array_contains: 'element' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { array_contains: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes array_starts_with operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { array_starts_with: 'first' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { array_starts_with: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes array_ends_with operator', () => {
      const query = {
        arguments: {
          where: {
            metadata: { array_ends_with: 'last' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            metadata: { array_ends_with: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })
  })
})
