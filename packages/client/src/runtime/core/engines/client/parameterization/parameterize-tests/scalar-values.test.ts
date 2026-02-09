import type { JsonQuery } from '@prisma/json-protocol'

import type { ParamGraph } from '@prisma/param-graph'

import { parameterizeQuery } from '../parameterize'
import { getParamGraph } from './test-fixtures'

let paramGraph: ParamGraph

beforeAll(async () => {
  paramGraph = await getParamGraph()
})

describe('parameterizeQuery scalar values', () => {
  it('parameterizes string values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findUnique',
      query: {
        arguments: { where: { email: 'test@example.com' } },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, paramGraph)

    expect(result).toMatchInlineSnapshot(`
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
                    "name": "%1",
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
          "%1": "test@example.com",
        },
      }
    `)
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

    const result = parameterizeQuery(query, paramGraph)

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
                  "value": {
                    "name": "%1",
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
          "%1": 42,
        },
      }
    `)
  })

  it('preserves null values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findUnique',
      query: {
        arguments: { where: { deletedAt: null } },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, paramGraph)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "deletedAt": null,
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

  it('parameterizes boolean values in where clauses', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findUnique',
      query: {
        arguments: { where: { isActive: true } },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, paramGraph)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findUnique",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "isActive": {
                  "$type": "Param",
                  "value": {
                    "name": "%1",
                    "type": "Boolean",
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
          "%1": true,
        },
      }
    `)
  })
})
