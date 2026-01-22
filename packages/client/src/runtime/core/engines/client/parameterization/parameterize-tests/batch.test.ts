import type { JsonBatchQuery } from '@prisma/json-protocol'

import { parameterizeBatch } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeBatch', () => {
  it('parameterizes all queries in a batch with unique placeholder names', () => {
    const batch: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 1 } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 2 } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result = parameterizeBatch(batch, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.id",
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
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[1].query.arguments.where.id",
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
          ],
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.id": 1,
          "batch[1].query.arguments.where.id": 2,
        },
      }
    `)
  })

  it('preserves transaction info', () => {
    const batch: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 1 } },
            selection: { $scalars: true },
          },
        },
      ],
      transaction: { isolationLevel: 'Serializable' },
    }

    const result = parameterizeBatch(batch, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.id",
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
          ],
          "transaction": {
            "isolationLevel": "Serializable",
          },
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.id": 1,
        },
      }
    `)
  })

  it('generates consistent cache keys for batches with same structure', () => {
    const batch1: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 1 } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 2 } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const batch2: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 100 } },
            selection: { $scalars: true },
          },
        },
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 200 } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result1 = parameterizeBatch(batch1, view)
    const result2 = parameterizeBatch(batch2, view)

    expect(result1).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.id",
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
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[1].query.arguments.where.id",
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
          ],
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.id": 1,
          "batch[1].query.arguments.where.id": 2,
        },
      }
    `)

    expect(result2).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.id",
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
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[1].query.arguments.where.id",
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
          ],
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.id": 100,
          "batch[1].query.arguments.where.id": 200,
        },
      }
    `)

    expect(JSON.stringify(result1.parameterizedBatch)).toBe(JSON.stringify(result2.parameterizedBatch))
  })

  it('generates different cache keys for batches with different structures', () => {
    const batch1: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { id: 1 } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const batch2: JsonBatchQuery = {
      batch: [
        {
          modelName: 'User',
          action: 'findUnique',
          query: {
            arguments: { where: { email: 'test@example.com' } },
            selection: { $scalars: true },
          },
        },
      ],
    }

    const result1 = parameterizeBatch(batch1, view)
    const result2 = parameterizeBatch(batch2, view)

    expect(result1).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "id": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.id",
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
          ],
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.id": 1,
        },
      }
    `)

    expect(result2).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [
            {
              "action": "findUnique",
              "modelName": "User",
              "query": {
                "arguments": {
                  "where": {
                    "email": {
                      "$type": "Param",
                      "value": {
                        "name": "batch[0].query.arguments.where.email",
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
          ],
        },
        "placeholderValues": {
          "batch[0].query.arguments.where.email": "test@example.com",
        },
      }
    `)

    expect(JSON.stringify(result1.parameterizedBatch)).not.toBe(JSON.stringify(result2.parameterizedBatch))
  })

  it('handles empty batch', () => {
    const batch: JsonBatchQuery = {
      batch: [],
    }

    const result = parameterizeBatch(batch, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedBatch": {
          "batch": [],
        },
        "placeholderValues": {},
      }
    `)
  })
})
