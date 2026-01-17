import type { JsonQuery } from '@prisma/json-protocol'

import { parameterizeQuery } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeQuery filter operators', () => {
  it('parameterizes equals filter', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findUnique',
      query: {
        arguments: { where: { age: { equals: 25 } } },
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
                "age": {
                  "equals": {
                    "$type": "Param",
                    "value": "query.arguments.where.age.equals",
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
          "query.arguments.where.age.equals": 25,
        },
      }
    `)
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

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "id": {
                  "in": {
                    "$type": "Param",
                    "value": "query.arguments.where.id.in",
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
          "query.arguments.where.id.in": [
            1,
            2,
            3,
          ],
        },
      }
    `)
  })

  it('parameterizes comparison operators (lt, lte, gt, gte)', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            age: { gte: 18, lte: 65 },
            salary: { gt: 50000, lt: 100000 },
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
                "age": {
                  "gte": {
                    "$type": "Param",
                    "value": "query.arguments.where.age.gte",
                  },
                  "lte": {
                    "$type": "Param",
                    "value": "query.arguments.where.age.lte",
                  },
                },
                "salary": {
                  "gt": {
                    "$type": "Param",
                    "value": "query.arguments.where.salary.gt",
                  },
                  "lt": {
                    "$type": "Param",
                    "value": "query.arguments.where.salary.lt",
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
          "query.arguments.where.age.gte": 18,
          "query.arguments.where.age.lte": 65,
          "query.arguments.where.salary.gt": 50000,
          "query.arguments.where.salary.lt": 100000,
        },
      }
    `)
  })

  it('parameterizes string operators (contains, startsWith, endsWith)', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            name: { contains: 'John' },
            email: { startsWith: 'admin', endsWith: '.com' },
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
                "email": {
                  "endsWith": {
                    "$type": "Param",
                    "value": "query.arguments.where.email.endsWith",
                  },
                  "startsWith": {
                    "$type": "Param",
                    "value": "query.arguments.where.email.startsWith",
                  },
                },
                "name": {
                  "contains": {
                    "$type": "Param",
                    "value": "query.arguments.where.name.contains",
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
          "query.arguments.where.email.endsWith": ".com",
          "query.arguments.where.email.startsWith": "admin",
          "query.arguments.where.name.contains": "John",
        },
      }
    `)
  })
})
