import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - logical operators', () => {
  describe('AND operator', () => {
    it('handles AND operator with array', () => {
      const query = {
        arguments: {
          where: {
            AND: [{ email: 'a@example.com' }, { name: 'Test' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: [{ email: PARAM_PLACEHOLDER }, { name: PARAM_PLACEHOLDER }],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles AND operator with single object', () => {
      const query = {
        arguments: {
          where: {
            AND: { email: 'a@example.com', name: 'Test' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: { email: PARAM_PLACEHOLDER, name: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles nested AND operators', () => {
      const query = {
        arguments: {
          where: {
            AND: [{ AND: [{ field1: 'value1' }, { field2: 'value2' }] }, { field3: 'value3' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: [
              { AND: [{ field1: PARAM_PLACEHOLDER }, { field2: PARAM_PLACEHOLDER }] },
              { field3: PARAM_PLACEHOLDER },
            ],
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('OR operator', () => {
    it('handles OR operator with array', () => {
      const query = {
        arguments: {
          where: {
            OR: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            OR: [{ status: PARAM_PLACEHOLDER }, { status: PARAM_PLACEHOLDER }],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles OR operator with complex conditions', () => {
      const query = {
        arguments: {
          where: {
            OR: [{ email: { contains: '@company.com' } }, { role: 'ADMIN' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            OR: [{ email: { contains: PARAM_PLACEHOLDER } }, { role: PARAM_PLACEHOLDER }],
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('NOT operator', () => {
    it('handles NOT operator with single object', () => {
      const query = {
        arguments: {
          where: {
            NOT: { email: 'admin@example.com' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            NOT: { email: PARAM_PLACEHOLDER },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles NOT operator as array', () => {
      const query = {
        arguments: {
          where: {
            NOT: [{ email: 'admin@example.com' }, { role: 'SYSTEM' }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            NOT: [{ email: PARAM_PLACEHOLDER }, { role: PARAM_PLACEHOLDER }],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles NOT operator with nested conditions', () => {
      const query = {
        arguments: {
          where: {
            NOT: {
              OR: [{ status: 'DELETED' }, { status: 'ARCHIVED' }],
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            NOT: {
              OR: [{ status: PARAM_PLACEHOLDER }, { status: PARAM_PLACEHOLDER }],
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('is/isNot operators (nullable relations)', () => {
    it('handles is operator with null', () => {
      const query = {
        arguments: {
          where: {
            profile: { is: null },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            profile: { is: null },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles is operator with nested conditions', () => {
      const query = {
        arguments: {
          where: {
            profile: { is: { bio: 'Developer' } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            profile: { is: { bio: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles isNot operator with null', () => {
      const query = {
        arguments: {
          where: {
            profile: { isNot: null },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            profile: { isNot: null },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles isNot operator with nested conditions', () => {
      const query = {
        arguments: {
          where: {
            profile: { isNot: { verified: false } },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            profile: { isNot: { verified: PARAM_PLACEHOLDER } },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('combined logical operators', () => {
    it('handles AND with OR', () => {
      const query = {
        arguments: {
          where: {
            AND: [
              { email: { contains: '@company.com' } },
              {
                OR: [{ role: 'ADMIN' }, { role: 'MODERATOR' }],
              },
            ],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: [
              { email: { contains: PARAM_PLACEHOLDER } },
              {
                OR: [{ role: PARAM_PLACEHOLDER }, { role: PARAM_PLACEHOLDER }],
              },
            ],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles AND with NOT', () => {
      const query = {
        arguments: {
          where: {
            AND: [{ isActive: true }, { NOT: { role: 'BANNED' } }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: [{ isActive: PARAM_PLACEHOLDER }, { NOT: { role: PARAM_PLACEHOLDER } }],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles OR with NOT', () => {
      const query = {
        arguments: {
          where: {
            OR: [{ status: 'ACTIVE' }, { NOT: { deletedAt: null } }],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            OR: [{ status: PARAM_PLACEHOLDER }, { NOT: { deletedAt: null } }],
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles complex nested logical operators', () => {
      const query = {
        arguments: {
          where: {
            AND: [
              {
                OR: [{ email: { endsWith: '@company.com' } }, { AND: [{ role: 'ADMIN' }, { verified: true }] }],
              },
              {
                NOT: {
                  OR: [{ status: 'BANNED' }, { status: 'SUSPENDED' }],
                },
              },
            ],
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: {
            AND: [
              {
                OR: [
                  { email: { endsWith: PARAM_PLACEHOLDER } },
                  { AND: [{ role: PARAM_PLACEHOLDER }, { verified: PARAM_PLACEHOLDER }] },
                ],
              },
              {
                NOT: {
                  OR: [{ status: PARAM_PLACEHOLDER }, { status: PARAM_PLACEHOLDER }],
                },
              },
            ],
          },
        },
        selection: { $scalars: true },
      })
    })
  })
})
