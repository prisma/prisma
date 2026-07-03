import type { JsonQuery } from '@prisma/json-protocol'
import { describe, expect, it } from 'vitest'

import { parameterizeQuery } from '../parameterize'
import { getParamGraph } from './test-fixtures'

const paramGraph = getParamGraph()

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

  it('parameterizes direct primitive Json values as Json placeholders', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findUnique',
      query: {
        arguments: { where: { metadata: 'test' } },
        selection: { id: true, metadata: true },
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
                "metadata": {
                  "$type": "Param",
                  "value": {
                    "name": "%1",
                    "type": "Json",
                  },
                },
              },
            },
            "selection": {
              "id": true,
              "metadata": true,
            },
          },
        },
        "placeholderValues": {
          "%1": ""test"",
        },
      }
    `)
  })

  it('parameterizes primitive Json filter values as Json placeholders', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: { where: { metadata: { equals: 42, not: true } } },
        selection: { id: true, metadata: true },
      },
    }

    const result = parameterizeQuery(query, paramGraph)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "metadata": {
                  "equals": {
                    "$type": "Param",
                    "value": {
                      "name": "%1",
                      "type": "Json",
                    },
                  },
                  "not": {
                    "$type": "Param",
                    "value": {
                      "name": "%2",
                      "type": "Json",
                    },
                  },
                },
              },
            },
            "selection": {
              "id": true,
              "metadata": true,
            },
          },
        },
        "placeholderValues": {
          "%1": "42",
          "%2": "true",
        },
      }
    `)
  })

  it('keeps Json string operators on String placeholders', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: { where: { metadata: { string_contains: 'test' } } },
        selection: { id: true, metadata: true },
      },
    }

    const result = parameterizeQuery(query, paramGraph)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "findMany",
          "modelName": "User",
          "query": {
            "arguments": {
              "where": {
                "metadata": {
                  "string_contains": {
                    "$type": "Param",
                    "value": {
                      "name": "%1",
                      "type": "String",
                    },
                  },
                },
              },
            },
            "selection": {
              "id": true,
              "metadata": true,
            },
          },
        },
        "placeholderValues": {
          "%1": "test",
        },
      }
    `)
  })
})
