import type { JsonQuery } from '@prisma/json-protocol'

import { parameterizeQuery } from '../parameterize'
import { view } from './test-fixtures'

describe('parameterizeQuery nested queries', () => {
  it('parameterizes relation filter values', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'findMany',
      query: {
        arguments: {
          where: {
            author: {
              name: { contains: 'Smith' },
            },
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
                "author": {
                  "name": {
                    "contains": {
                      "$type": "Param",
                      "value": {
                        "name": "query.arguments.where.author.name.contains",
                        "type": "String",
                      },
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
          "query.arguments.where.author.name.contains": "Smith",
        },
      }
    `)
  })

  it('parameterizes nested data in create', () => {
    const query: JsonQuery = {
      modelName: 'User',
      action: 'createOne',
      query: {
        arguments: {
          data: {
            name: 'John',
            email: 'john@example.com',
            posts: {
              create: [{ title: 'Hello', content: 'World' }],
            },
          },
        },
        selection: { $scalars: true },
      },
    }

    const result = parameterizeQuery(query, view)

    expect(result).toMatchInlineSnapshot(`
      {
        "parameterizedQuery": {
          "action": "createOne",
          "modelName": "User",
          "query": {
            "arguments": {
              "data": {
                "email": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.data.email",
                    "type": "String",
                  },
                },
                "name": {
                  "$type": "Param",
                  "value": {
                    "name": "query.arguments.data.name",
                    "type": "String",
                  },
                },
                "posts": {
                  "create": [
                    {
                      "content": {
                        "$type": "Param",
                        "value": "query.arguments.data.posts.create[0].content",
                      },
                      "title": {
                        "$type": "Param",
                        "value": "query.arguments.data.posts.create[0].title",
                      },
                    },
                  ],
                },
              },
            },
            "selection": {
              "$scalars": true,
            },
          },
        },
        "placeholderValues": {
          "query.arguments.data.email": "john@example.com",
          "query.arguments.data.name": "John",
          "query.arguments.data.posts.create[0].content": "World",
          "query.arguments.data.posts.create[0].title": "Hello",
        },
      }
    `)
  })
})
