import type { QueryPlanNode } from '../src/query-plan'

export const SIMPLE_SELECT_PLAN: QueryPlanNode = {
  type: 'dataMap',
  args: {
    expr: {
      type: 'query',
      args: [['SELECT id, email, name FROM User LIMIT 10'], ['?', false], [], [], false],
    },
    structure: {
      type: 'object',
      serializedName: null,
      skipNulls: false,
      fields: {
        id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
        email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
        name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
      },
    },
    enums: {},
  },
}

export const FIND_UNIQUE_PLAN: QueryPlanNode = {
  type: 'dataMap',
  args: {
    expr: {
      type: 'unique',
      args: {
        type: 'query',
        args: [
          ['SELECT id, email, name, bio, avatar, isActive, role, createdAt FROM User WHERE id = ', null],
          ['?', false],
          [1],
          [{ scalarType: 'int', arity: 'scalar' }],
          false,
        ],
      },
    },
    structure: {
      type: 'object',
      serializedName: null,
      skipNulls: false,
      fields: {
        id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
        email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
        name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
        bio: { type: 'field', dbName: 'bio', fieldType: { type: 'string', arity: 'scalar' } },
        avatar: { type: 'field', dbName: 'avatar', fieldType: { type: 'string', arity: 'scalar' } },
        isActive: { type: 'field', dbName: 'isActive', fieldType: { type: 'boolean', arity: 'scalar' } },
        role: { type: 'field', dbName: 'role', fieldType: { type: 'string', arity: 'scalar' } },
        createdAt: { type: 'field', dbName: 'createdAt', fieldType: { type: 'datetime', arity: 'scalar' } },
      },
    },
    enums: {},
  },
}

export const JOIN_PLAN: QueryPlanNode = {
  type: 'dataMap',
  args: {
    expr: {
      type: 'join',
      args: {
        parent: {
          type: 'query',
          args: [
            ['SELECT id, email, name FROM User WHERE id = ', null],
            ['?', false],
            [1],
            [{ scalarType: 'int', arity: 'scalar' }],
            false,
          ],
        },
        children: [
          [
            {
              type: 'query',
              args: [
                ['SELECT id, title, content, authorId FROM Post WHERE authorId = ', null],
                ['?', false],
                [1],
                [{ scalarType: 'int', arity: 'scalar' }],
                false,
              ],
            },
            [['id', 'authorId']],
            'posts',
            false,
          ],
        ],
        canAssumeStrictEquality: true,
      },
    },
    structure: {
      type: 'object',
      serializedName: null,
      skipNulls: false,
      fields: {
        id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
        email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
        name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
        posts: {
          type: 'object',
          serializedName: 'posts',
          skipNulls: false,
          fields: {
            id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
            title: { type: 'field', dbName: 'title', fieldType: { type: 'string', arity: 'scalar' } },
            content: { type: 'field', dbName: 'content', fieldType: { type: 'string', arity: 'scalar' } },
          },
        },
      },
    },
    enums: {},
  },
}

export const SEQUENCE_PLAN: QueryPlanNode = {
  type: 'seq',
  args: [
    {
      type: 'execute',
      args: [
        ['UPDATE User SET name = ', null, ' WHERE id = ', null],
        ['?', false],
        ['Updated Name', 1],
        [
          { scalarType: 'string', arity: 'scalar' },
          { scalarType: 'int', arity: 'scalar' },
        ],
        false,
      ],
    },
    {
      type: 'dataMap',
      args: {
        expr: {
          type: 'query',
          args: [
            ['SELECT id, name FROM User WHERE id = ', null],
            ['?', false],
            [1],
            [{ scalarType: 'int', arity: 'scalar' }],
            false,
          ],
        },
        structure: {
          type: 'object',
          serializedName: null,
          skipNulls: false,
          fields: {
            id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
            name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
          },
        },
        enums: {},
      },
    },
  ],
}

export const DEEP_JOIN_PLAN: QueryPlanNode = {
  type: 'dataMap',
  args: {
    expr: {
      type: 'join',
      args: {
        parent: {
          type: 'join',
          args: {
            parent: {
              type: 'query',
              args: [['SELECT id, email, name FROM User LIMIT 5'], ['?', false], [], [], false],
            },
            children: [
              [
                {
                  type: 'query',
                  args: [
                    ['SELECT id, userId, firstName, lastName FROM Profile WHERE userId IN (1, 2, 3, 4, 5)'],
                    ['?', false],
                    [],
                    [],
                    false,
                  ],
                },
                [['id', 'userId']],
                'profile',
                true,
              ],
            ],
            canAssumeStrictEquality: true,
          },
        },
        children: [
          [
            {
              type: 'join',
              args: {
                parent: {
                  type: 'query',
                  args: [
                    ['SELECT id, title, authorId FROM Post WHERE authorId IN (1, 2, 3, 4, 5) LIMIT 20'],
                    ['?', false],
                    [],
                    [],
                    false,
                  ],
                },
                children: [
                  [
                    {
                      type: 'query',
                      args: [
                        [
                          'SELECT id, content, postId, authorId FROM Comment WHERE postId IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)',
                        ],
                        ['?', false],
                        [],
                        [],
                        false,
                      ],
                    },
                    [['id', 'postId']],
                    'comments',
                    false,
                  ],
                ],
                canAssumeStrictEquality: true,
              },
            },
            [['id', 'authorId']],
            'posts',
            false,
          ],
        ],
        canAssumeStrictEquality: true,
      },
    },
    structure: {
      type: 'object',
      serializedName: null,
      skipNulls: false,
      fields: {
        id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
        email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
        name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
        profile: {
          type: 'object',
          serializedName: 'profile',
          skipNulls: false,
          fields: {
            id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
            firstName: { type: 'field', dbName: 'firstName', fieldType: { type: 'string', arity: 'scalar' } },
            lastName: { type: 'field', dbName: 'lastName', fieldType: { type: 'string', arity: 'scalar' } },
          },
        },
        posts: {
          type: 'object',
          serializedName: 'posts',
          skipNulls: false,
          fields: {
            id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
            title: { type: 'field', dbName: 'title', fieldType: { type: 'string', arity: 'scalar' } },
            comments: {
              type: 'object',
              serializedName: 'comments',
              skipNulls: false,
              fields: {
                id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
                content: { type: 'field', dbName: 'content', fieldType: { type: 'string', arity: 'scalar' } },
              },
            },
          },
        },
      },
    },
    enums: {},
  },
}
