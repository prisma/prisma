import { describe, expect, it } from 'vitest'

import { PARAM_PLACEHOLDER, parameterizeQuery } from '../parameterize'

describe('parameterizeQuery - orderBy', () => {
  describe('simple orderBy', () => {
    it('preserves sort direction strings', () => {
      const query = {
        arguments: {
          orderBy: {
            createdAt: { sort: 'desc', nulls: 'last' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            createdAt: { sort: 'desc', nulls: 'last' },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('preserves simple sort direction string (shorthand format)', () => {
      const query = {
        arguments: {
          orderBy: {
            name: 'asc',
          },
        },
        selection: { $scalars: true },
      }

      // Shorthand orderBy format should preserve sort direction
      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            name: 'asc',
          },
        },
        selection: { $scalars: true },
      })
    })

    it('preserves desc sort direction in shorthand format', () => {
      const query = {
        arguments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        selection: { $scalars: true },
      })
    })

    it('preserves sort with nulls handling', () => {
      const query = {
        arguments: {
          orderBy: {
            updatedAt: { sort: 'asc', nulls: 'first' },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            updatedAt: { sort: 'asc', nulls: 'first' },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('orderBy as array', () => {
    it('handles orderBy with multiple fields', () => {
      const query = {
        arguments: {
          orderBy: [{ lastName: { sort: 'asc' } }, { firstName: { sort: 'asc' } }],
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: [{ lastName: { sort: 'asc' } }, { firstName: { sort: 'asc' } }],
        },
        selection: { $scalars: true },
      })
    })

    it('handles mixed orderBy array formats', () => {
      const query = {
        arguments: {
          orderBy: [{ createdAt: { sort: 'desc' } }, { name: 'asc' }],
        },
        selection: { $scalars: true },
      }

      // Both long format and shorthand format should be preserved
      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: [{ createdAt: { sort: 'desc' } }, { name: 'asc' }],
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('nested relation orderBy', () => {
    it('handles orderBy on nested relation', () => {
      const query = {
        arguments: {
          orderBy: {
            author: {
              name: { sort: 'asc' },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            author: {
              name: { sort: 'asc' },
            },
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles orderBy in nested selection', () => {
      const query = {
        selection: {
          $scalars: true,
          posts: {
            arguments: {
              orderBy: { createdAt: { sort: 'desc' } },
            },
            selection: { $scalars: true },
          },
        },
      }

      expect(parameterizeQuery(query)).toEqual({
        selection: {
          $scalars: true,
          posts: {
            arguments: {
              orderBy: { createdAt: { sort: 'desc' } },
            },
            selection: { $scalars: true },
          },
        },
      })
    })
  })

  describe('orderBy with aggregates', () => {
    it('handles orderBy with _count', () => {
      const query = {
        arguments: {
          orderBy: {
            posts: {
              _count: { sort: 'desc' },
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          orderBy: {
            posts: {
              _count: { sort: 'desc' },
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })
})

describe('parameterizeQuery - pagination', () => {
  describe('take', () => {
    it('preserves take value', () => {
      const query = {
        arguments: {
          take: 10,
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          take: 10,
        },
        selection: { $scalars: true },
      })
    })

    it('preserves negative take value (for reverse pagination)', () => {
      const query = {
        arguments: {
          take: -10,
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          take: -10,
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('skip', () => {
    it('preserves skip value', () => {
      const query = {
        arguments: {
          skip: 20,
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          skip: 20,
        },
        selection: { $scalars: true },
      })
    })

    it('preserves skip value of zero', () => {
      const query = {
        arguments: {
          skip: 0,
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          skip: 0,
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('cursor', () => {
    it('parameterizes cursor values', () => {
      const query = {
        arguments: {
          cursor: {
            id: 123,
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          cursor: {
            id: PARAM_PLACEHOLDER,
          },
        },
        selection: { $scalars: true },
      })
    })

    it('parameterizes cursor with compound key', () => {
      const query = {
        arguments: {
          cursor: {
            tenantId_id: {
              tenantId: 'tenant-123',
              id: 456,
            },
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          cursor: {
            tenantId_id: {
              tenantId: PARAM_PLACEHOLDER,
              id: PARAM_PLACEHOLDER,
            },
          },
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('combined pagination', () => {
    it('handles take, skip, and cursor together', () => {
      const query = {
        arguments: {
          take: 10,
          skip: 1,
          cursor: {
            id: 100,
          },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          take: 10,
          skip: 1,
          cursor: {
            id: PARAM_PLACEHOLDER,
          },
        },
        selection: { $scalars: true },
      })
    })

    it('handles pagination with orderBy', () => {
      const query = {
        arguments: {
          take: 20,
          skip: 0,
          orderBy: { createdAt: { sort: 'desc' } },
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          take: 20,
          skip: 0,
          orderBy: { createdAt: { sort: 'desc' } },
        },
        selection: { $scalars: true },
      })
    })

    it('handles pagination with where clause', () => {
      const query = {
        arguments: {
          where: { status: 'ACTIVE' },
          take: 10,
          skip: 5,
        },
        selection: { $scalars: true },
      }

      expect(parameterizeQuery(query)).toEqual({
        arguments: {
          where: { status: PARAM_PLACEHOLDER },
          take: 10,
          skip: 5,
        },
        selection: { $scalars: true },
      })
    })
  })

  describe('pagination in nested selections', () => {
    it('preserves pagination in nested relation', () => {
      const query = {
        selection: {
          $scalars: true,
          posts: {
            arguments: {
              take: 5,
              skip: 0,
            },
            selection: { $scalars: true },
          },
        },
      }

      expect(parameterizeQuery(query)).toEqual({
        selection: {
          $scalars: true,
          posts: {
            arguments: {
              take: 5,
              skip: 0,
            },
            selection: { $scalars: true },
          },
        },
      })
    })
  })
})

describe('parameterizeQuery - distinct', () => {
  it('preserves distinct field names', () => {
    const query = {
      arguments: {
        distinct: ['email'],
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        distinct: ['email'],
      },
      selection: { $scalars: true },
    })
  })

  it('preserves distinct with multiple fields', () => {
    const query = {
      arguments: {
        distinct: ['email', 'name'],
      },
      selection: { $scalars: true },
    }

    expect(parameterizeQuery(query)).toEqual({
      arguments: {
        distinct: ['email', 'name'],
      },
      selection: { $scalars: true },
    })
  })
})
