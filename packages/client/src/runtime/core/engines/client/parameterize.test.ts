import { JsonQuery } from '@prisma/json-protocol'
import { parameterizeQuery } from './parameterize'

describe('parameterizeQuery', () => {
  describe('top-level structural keys', () => {
    it('preserves modelName and action', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        modelName: 'User',
        action: 'findUnique',
      })
      expect(result.placeholderValues).not.toHaveProperty('modelName')
      expect(result.placeholderValues).not.toHaveProperty('action')
    })
  })

  describe('scalar values', () => {
    it('parameterizes string values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { email: 'test@example.com' } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            where: {
              email: { $type: 'Param', value: expect.stringContaining('email') },
            },
          },
        },
      })
      expect(Object.values(result.placeholderValues)).toContain('test@example.com')
    })

    it('parameterizes number values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 42 } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(Object.values(result.placeholderValues)).toContain(42)
    })

    it('preserves null values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { deletedAt: null } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            where: {
              deletedAt: null,
            },
          },
        },
      })
    })

    it('parameterizes boolean values in where clauses', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { isActive: true } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(Object.values(result.placeholderValues)).toContain(true)
    })
  })

  describe('filter operators', () => {
    it('parameterizes equals filter', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { age: { equals: 25 } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(Object.values(result.placeholderValues)).toContain(25)
    })

    it('parameterizes in filter with array', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: { where: { id: { in: [1, 2, 3] } } },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(Object.values(result.placeholderValues)).toEqual(expect.arrayContaining([1, 2, 3]))
      expect(result.placeholderPaths).toHaveLength(3)
    })

    it('parameterizes comparison operators (lt, lte, gt, gte)', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              age: { gte: 18, lte: 65 },
              salary: { gt: 50000, lt: 200000 },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      const values = Object.values(result.placeholderValues)
      expect(values).toContain(18)
      expect(values).toContain(65)
      expect(values).toContain(50000)
      expect(values).toContain(200000)
    })

    it('parameterizes string operators (contains, startsWith, endsWith)', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              name: { contains: 'john' },
              email: { startsWith: 'admin', endsWith: '.com' },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      const values = Object.values(result.placeholderValues)
      expect(values).toContain('john')
      expect(values).toContain('admin')
      expect(values).toContain('.com')
    })
  })

  describe('structural values', () => {
    it('preserves selection booleans', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: {
            id: true,
            name: true,
            email: false,
          },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          selection: {
            id: true,
            name: true,
            email: false,
          },
        },
      })
    })

    it('preserves $scalars and $composites markers', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: {
            $scalars: true,
            $composites: true,
          },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          selection: {
            $scalars: true,
            $composites: true,
          },
        },
      })
    })

    it('preserves orderBy directions', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
          },
        },
      })
      expect(Object.keys(result.placeholderValues)).toHaveLength(0)
    })

    it('preserves take and skip values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            take: 10,
            skip: 20,
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            take: 10,
            skip: 20,
          },
        },
      })
    })

    it('preserves mode flag', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              name: { contains: 'test', mode: 'insensitive' },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            where: {
              name: { mode: 'insensitive' },
            },
          },
        },
      })
      // 'test' should be parameterized but 'insensitive' should not
      expect(Object.values(result.placeholderValues)).toContain('test')
      expect(Object.values(result.placeholderValues)).not.toContain('insensitive')
    })
  })

  describe('nested queries', () => {
    it('parameterizes relation filter values', () => {
      const query: JsonQuery = {
        modelName: 'Post',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              author: {
                name: { contains: 'john' },
              },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(Object.values(result.placeholderValues)).toContain('john')
    })

    it('parameterizes nested data in create', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'createOne',
        query: {
          arguments: {
            data: {
              name: 'Alice',
              email: 'alice@example.com',
              posts: {
                create: {
                  title: 'Hello World',
                  content: 'Content here',
                },
              },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      const values = Object.values(result.placeholderValues)
      expect(values).toContain('Alice')
      expect(values).toContain('alice@example.com')
      expect(values).toContain('Hello World')
      expect(values).toContain('Content here')
    })
  })

  describe('tagged values', () => {
    it('parameterizes DateTime tagged values', () => {
      const dateValue = { $type: 'DateTime', value: '2023-01-01T00:00:00.000Z' }
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: { createdAt: dateValue },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      // DateTime values are unwrapped when stored in placeholderValues
      expect(Object.values(result.placeholderValues)).toContainEqual(dateValue.value)
    })

    it('preserves FieldRef tagged values', () => {
      const fieldRef = { $type: 'FieldRef', value: { _ref: 'otherField', _container: 'User' } }
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: { balance: { gt: fieldRef } },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.parameterizedQuery).toMatchObject({
        query: {
          arguments: {
            where: {
              balance: { gt: fieldRef },
            },
          },
        },
      })
      expect(Object.values(result.placeholderValues)).not.toContainEqual(fieldRef)
    })
  })

  describe('placeholder naming', () => {
    it('generates deterministic names for same structure', () => {
      const query1: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: { $scalars: true },
        },
      }

      const query2: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 2 } },
          selection: { $scalars: true },
        },
      }

      const result1 = parameterizeQuery(query1)
      const result2 = parameterizeQuery(query2)

      // Same placeholder paths despite different values
      expect(result1.placeholderPaths).toEqual(result2.placeholderPaths)
    })

    it('generates unique names for different values', () => {
      const query: JsonQuery = {
        modelName: 'User',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              id: { in: [1, 2, 3] },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      // All paths should be unique
      const uniquePaths = new Set(result.placeholderPaths)
      expect(uniquePaths.size).toBe(result.placeholderPaths.length)
    })

    it('handles deeply nested paths', () => {
      const query: JsonQuery = {
        modelName: 'Post',
        action: 'findMany',
        query: {
          arguments: {
            where: {
              author: {
                profile: {
                  bio: { contains: 'developer' },
                },
              },
            },
          },
          selection: { $scalars: true },
        },
      }

      const result = parameterizeQuery(query)

      expect(result.placeholderPaths[0]).toContain('author')
      expect(result.placeholderPaths[0]).toContain('profile')
      expect(result.placeholderPaths[0]).toContain('bio')
    })
  })

  describe('cache key consistency', () => {
    it('generates same cache key for same query structure', () => {
      const query1: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: { $scalars: true },
        },
      }

      const query2: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 2 } },
          selection: { $scalars: true },
        },
      }

      const result1 = parameterizeQuery(query1)
      const result2 = parameterizeQuery(query2)

      const cacheKey1 = JSON.stringify(result1.parameterizedQuery)
      const cacheKey2 = JSON.stringify(result2.parameterizedQuery)

      expect(cacheKey1).toBe(cacheKey2)
    })

    it('generates different cache key for different query structure', () => {
      const query1: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { id: 1 } },
          selection: { $scalars: true },
        },
      }

      const query2: JsonQuery = {
        modelName: 'User',
        action: 'findUnique',
        query: {
          arguments: { where: { email: 'test@example.com' } },
          selection: { $scalars: true },
        },
      }

      const result1 = parameterizeQuery(query1)
      const result2 = parameterizeQuery(query2)

      const cacheKey1 = JSON.stringify(result1.parameterizedQuery)
      const cacheKey2 = JSON.stringify(result2.parameterizedQuery)

      expect(cacheKey1).not.toBe(cacheKey2)
    })
  })
})
