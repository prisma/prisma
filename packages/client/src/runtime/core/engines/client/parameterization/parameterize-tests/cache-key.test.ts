import type { JsonQuery } from '@prisma/json-protocol'

import { parameterizeQuery } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeQuery cache key consistency', () => {
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
        arguments: { where: { id: 999 } },
        selection: { $scalars: true },
      },
    }

    const result1 = parameterizeQuery(query1, view)
    const result2 = parameterizeQuery(query2, view)

    expect(result1).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.id",
                    "type": "Int",
                  },
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

    expect(result2).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.id",
                    "type": "Int",
                  },
                },
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.id": 999,
        },
      }
    `)

    expect(result1.parameterizedQuery).toEqual(result2.parameterizedQuery)
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

    const result1 = parameterizeQuery(query1, view)
    const result2 = parameterizeQuery(query2, view)

    expect(result1).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.id",
                    "type": "Int",
                  },
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

    expect(result2).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "email": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.email",
                    "type": "String",
                  },
                },
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.email": "test@example.com",
        },
      }
    `)

    expect(result1.parameterizedQuery).not.toEqual(result2.parameterizedQuery)
  })
})
