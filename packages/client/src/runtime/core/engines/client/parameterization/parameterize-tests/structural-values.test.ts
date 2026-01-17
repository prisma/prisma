import type { JsonQuery } from '@prisma/json-protocol'

import { parameterizeQuery } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeQuery structural values', () => {
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

      const result = parameterizeQuery(query, view)

      expect(result).toMatchInlineSnapshot(`
        {
          "parameterizedQuery": {
            "action": "findUnique",
            "modelName": "User",
            "query": {
              "arguments": {
                "where": {
                  "id": {
                    "$type": "Param",
                    "value": "query.arguments.where.id",
                  },
                },
              },
              "selection": {
                "$scalars": true,
              },
            },
          },
          "placeholderValues": {
            "query.arguments.where.id": 1,
          },
        }
      `)
    })
  })

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

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "$type": "Param",
                  "value": "query.arguments.where.id",
                },
              },
            },
            "selection": {
              "email": false,
              "id": true,
              "name": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.id": 1,
        },
      }
    `)
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

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "$type": "Param",
                  "value": "query.arguments.where.id",
                },
              },
            },
            "selection": {
              "$composites": true,
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.id": 1,
        },
      }
    `)
  })

  it('preserves orderBy directions', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          orderBy: { name: 'asc', createdAt: 'desc' },
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "orderBy": {
                "createdAt": "desc",
                "name": "asc",
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {},
      }
    `)
  })

  it('preserves take and skip values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          take: 10,
          skip: 5,
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "skip": 5,
              "take": 10,
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {},
      }
    `)
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

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "name": {
                  "contains": {
                    "$type": "Param",
                    "value": "query.arguments.where.name.contains",
                  },
                  "mode": "insensitive",
                },
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.name.contains": "test",
        },
      }
    `)
  })
})
