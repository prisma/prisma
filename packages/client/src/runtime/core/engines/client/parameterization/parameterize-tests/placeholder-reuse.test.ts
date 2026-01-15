import type { JsonQuery } from '@prisma/json-protocol'

import { parameterizeQuery } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeQuery placeholder reuse', () => {
  it('reuses placeholder for identical string values at different paths', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'upsertOne',
      query: {
        arguments: {
          where: { email: 'test@example.com' },
          create: { email: 'test@example.com' },
          update: {},
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "upsertOne",
          "modelName": "User",
          "query": {
            "arguments": {
              "create": {
                "email": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.email",
                    "type": "String",
                  },
                },
              },
              "update": {},
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
  })

  it('reuses placeholder for identical Int values at different paths', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            age: 42,
            id: 42,
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
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.age",
                    "type": "Int",
                  },
                },
                "id": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.age",
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
          "query.arguments.where.age": 42,
        },
      }
    `)
  })

  it('reuses placeholder for identical DateTime tagged values', () => {
    const dateValue = { $type: 'DateTime' as const, value: '2024-01-01T00:00:00.000Z' }
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            createdAt: { gte: dateValue, lte: dateValue },
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
                "createdAt": {
                  "gte": {
                    "$type": "Param",
                    "value": {
                      "name": "query.arguments.where.createdAt.gte",
                      "type": "DateTime",
                    },
                  },
                  "lte": {
                    "$type": "Param",
                    "value": {
                      "name": "query.arguments.where.createdAt.gte",
                      "type": "DateTime",
                    },
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
          "query.arguments.where.createdAt.gte": "2024-01-01T00:00:00.000Z",
        },
      }
    `)
  })

  it('reuses placeholder for identical Bytes tagged values', () => {
    const bytesValue = { $type: 'Bytes' as const, value: 'SGVsbG8gV29ybGQ=' }
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            avatar: { equals: bytesValue, not: bytesValue },
          },
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result.parameterizedQuery).toMatchInlineSnapshot(`
      {
        "action": "findMany",
        "modelName": "User",
        "query": {
          "arguments": {
            "where": {
              "avatar": {
                "equals": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.avatar.equals",
                    "type": "Bytes",
                  },
                },
                "not": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.where.avatar.equals",
                    "type": "Bytes",
                  },
                },
              },
            },
          },
          "selection": {
            "$scalars": true,
          },
        },
      }
    `)

    expect(Object.keys(result.placeholderValues)).toEqual(['query.arguments.where.avatar.equals'])
    expect(result.placeholderValues['query.arguments.where.avatar.equals']).toBeInstanceOf(Uint8Array)
  })

  it('reuses placeholder for identical array values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            OR: [{ id: { in: [1, 2, 3] } }, { age: { in: [1, 2, 3] } }],
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
                "OR": [
                  {
                    "id": {
                      "in": {
                        "$type": "Param",
                        "value": {
                          "inner": {
                            "type": "Int",
                          },
                          "name": "query.arguments.where.OR[0].id.in",
                          "type": "List",
                        },
                      },
                    },
                  },
                  {
                    "age": {
                      "in": {
                        "$type": "Param",
                        "value": {
                          "inner": {
                            "type": "Int",
                          },
                          "name": "query.arguments.where.OR[0].id.in",
                          "type": "List",
                        },
                      },
                    },
                  },
                ],
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.OR[0].id.in": [
            1,
            2,
            3,
          ],
        },
      }
    `)
  })

  it('reuses placeholder for enum values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            OR: [{ status: 'ACTIVE' }, { status: 'ACTIVE' }],
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
                "OR": [
                  {
                    "status": {
                      "$type": "Param",
                      "value": {
                        "name": "query.arguments.where.OR[0].status",
                        "type": "Enum",
                      },
                    },
                  },
                  {
                    "status": {
                      "$type": "Param",
                      "value": {
                        "name": "query.arguments.where.OR[0].status",
                        "type": "Enum",
                      },
                    },
                  },
                ],
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.where.OR[0].status": "ACTIVE",
        },
      }
    `)
  })

  it('does not share placeholders between different string values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'upsertOne',
      query: {
        arguments: {
          where: { email: 'alice@example.com' },
          create: { email: 'bob@example.com' },
          update: {},
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "upsertOne",
          "modelName": "User",
          "query": {
            "arguments": {
              "create": {
                "email": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.create.email",
                    "type": "String",
                  },
                },
              },
              "update": {},
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
          "query.arguments.create.email": "bob@example.com",
          "query.arguments.where.email": "alice@example.com",
        },
      }
    `)
  })
})
