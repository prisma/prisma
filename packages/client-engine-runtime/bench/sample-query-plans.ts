import type { QueryPlanNode } from '../src/query-plan'

export const SIMPLE_SELECT_PLAN: QueryPlanNode = [
  'd',
  ['q', [['SELECT id, email, name FROM User LIMIT 10'], ['?', false], [], [], false]],
  [
    null,
    {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
    },
  ],
  {},
]

export const FIND_UNIQUE_PLAN: QueryPlanNode = [
  'd',
  [
    'u',
    [
      'q',
      [
        ['SELECT id, email, name, bio, avatar, isActive, role, createdAt FROM User WHERE id = ', null],
        ['?', false],
        [1],
        ['i'],
        false,
      ],
    ],
  ],
  [
    null,
    {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
      bio: { type: 'field', dbName: 'bio', fieldType: { type: 'string', arity: 'scalar' } },
      avatar: { type: 'field', dbName: 'avatar', fieldType: { type: 'string', arity: 'scalar' } },
      isActive: { type: 'field', dbName: 'isActive', fieldType: { type: 'boolean', arity: 'scalar' } },
      role: { type: 'field', dbName: 'role', fieldType: { type: 'string', arity: 'scalar' } },
      createdAt: { type: 'field', dbName: 'createdAt', fieldType: { type: 'datetime', arity: 'scalar' } },
    },
  ],
  {},
]

export const JOIN_PLAN: QueryPlanNode = [
  'd',
  [
    'j',
    ['q', [['SELECT id, email, name FROM User WHERE id = ', null], ['?', false], [1], ['i'], false]],
    [
      [
        [
          'q',
          [['SELECT id, title, content, authorId FROM Post WHERE authorId = ', null], ['?', false], [1], ['i'], false],
        ],
        [['id', 'authorId']],
        'posts',
        false,
      ],
    ],
    true,
  ],
  [
    null,
    {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
      posts: [
        'posts',
        {
          id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
          title: { type: 'field', dbName: 'title', fieldType: { type: 'string', arity: 'scalar' } },
          content: { type: 'field', dbName: 'content', fieldType: { type: 'string', arity: 'scalar' } },
        },
      ],
    },
  ],
  {},
]

export const SEQUENCE_PLAN: QueryPlanNode = [
  's',
  [
    [
      'x',
      [['UPDATE User SET name = ', null, ' WHERE id = ', null], ['?', false], ['Updated Name', 1], ['s', 'i'], false],
    ],
    [
      'd',
      ['q', [['SELECT id, name FROM User WHERE id = ', null], ['?', false], [1], ['i'], false]],
      [
        null,
        {
          id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
          name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
        },
      ],
      {},
    ],
  ],
]

export const DEEP_JOIN_PLAN: QueryPlanNode = [
  'd',
  [
    'j',
    [
      'j',
      ['q', [['SELECT id, email, name FROM User LIMIT 5'], ['?', false], [], [], false]],
      [
        [
          [
            'q',
            [
              ['SELECT id, userId, firstName, lastName FROM Profile WHERE userId IN (1, 2, 3, 4, 5)'],
              ['?', false],
              [],
              [],
              false,
            ],
          ],
          [['id', 'userId']],
          'profile',
          true,
        ],
      ],
      true,
    ],
    [
      [
        [
          'j',
          [
            'q',
            [
              ['SELECT id, title, authorId FROM Post WHERE authorId IN (1, 2, 3, 4, 5) LIMIT 20'],
              ['?', false],
              [],
              [],
              false,
            ],
          ],
          [
            [
              [
                'q',
                [
                  ['SELECT id, content, postId, authorId FROM Comment WHERE postId IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10)'],
                  ['?', false],
                  [],
                  [],
                  false,
                ],
              ],
              [['id', 'postId']],
              'comments',
              false,
            ],
          ],
          true,
        ],
        [['id', 'authorId']],
        'posts',
        false,
      ],
    ],
    true,
  ],
  [
    null,
    {
      id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
      email: { type: 'field', dbName: 'email', fieldType: { type: 'string', arity: 'scalar' } },
      name: { type: 'field', dbName: 'name', fieldType: { type: 'string', arity: 'scalar' } },
      profile: [
        'profile',
        {
          id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
          firstName: { type: 'field', dbName: 'firstName', fieldType: { type: 'string', arity: 'scalar' } },
          lastName: { type: 'field', dbName: 'lastName', fieldType: { type: 'string', arity: 'scalar' } },
        },
      ],
      posts: [
        'posts',
        {
          id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
          title: { type: 'field', dbName: 'title', fieldType: { type: 'string', arity: 'scalar' } },
          comments: [
            'comments',
            {
              id: { type: 'field', dbName: 'id', fieldType: { type: 'int', arity: 'scalar' } },
              content: { type: 'field', dbName: 'content', fieldType: { type: 'string', arity: 'scalar' } },
            },
          ],
        },
      ],
    },
  ],
  {},
]
