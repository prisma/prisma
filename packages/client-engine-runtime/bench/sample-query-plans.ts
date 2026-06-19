import type { QueryPlanNode } from '../src/query-plan'

export const SIMPLE_SELECT_PLAN: QueryPlanNode = [
  'd',
  ['q', [['SELECT id, email, name FROM User LIMIT 10'], ['?', false], [], [], false]],
  [
    null,
    {
      id: 'i',
      email: 's',
      name: 's',
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
      id: 'i',
      email: 's',
      name: 's',
      bio: 's',
      avatar: 's',
      isActive: 'b',
      role: 's',
      createdAt: 'D',
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
      id: 'i',
      email: 's',
      name: 's',
      posts: [
        'posts',
        {
          id: 'i',
          title: 's',
          content: 's',
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
          id: 'i',
          name: 's',
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
      id: 'i',
      email: 's',
      name: 's',
      profile: [
        'profile',
        {
          id: 'i',
          firstName: 's',
          lastName: 's',
        },
      ],
      posts: [
        'posts',
        {
          id: 'i',
          title: 's',
          comments: [
            'comments',
            {
              id: 'i',
              content: 's',
            },
          ],
        },
      ],
    },
  ],
  {},
]
