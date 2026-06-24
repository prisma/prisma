import { expect, test } from 'vitest'

import type { QueryPlanDbQuery } from '../query-plan'
import { GeneratorRegistry } from './generators'
import { renderQuery } from './render-query'
import { ScopeBindings } from './scope'

const TEST_MAX_CHUNK_SIZE = 10

test('no template', () => {
  expect(
    renderQuery(
      {
        type: 'rawSql',
        sql: 'SELECT * FROM users WHERE id = $1',
        args: [1],
        argTypes: [{ arity: 'scalar', scalarType: 'int' }],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1',
      args: [1],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
    },
  ])
})

test('no template and scalar list parameter', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND numbers = ', null],
        ['$', true],
        [1, [1, 2, 3]],
        [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'list', scalarType: 'int' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND numbers = $2',
      args: [1, [1, 2, 3]],
      argTypes: [
        { arity: 'scalar', scalarType: 'int' },
        { arity: 'list', scalarType: 'int' },
      ],
    },
  ])
})

test('accepts compact scalar arg types', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND name = ', null],
        ['$', true],
        [1, 'Alice'],
        ['i', 's'],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND name = $2',
      args: [1, 'Alice'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
  ])
})

test('accepts compact native scalar arg types', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND email = ', null],
        ['$', true],
        [1, 'alice@example.com'],
        [
          ['i', 'INTEGER'],
          ['s', 'TEXT'],
        ],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND email = $2',
      args: [1, 'alice@example.com'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int', dbType: 'INTEGER' },
        { arity: 'scalar', scalarType: 'string', dbType: 'TEXT' },
      ],
    },
  ])
})

test('accepts compact template SQL queries', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND name = ', null],
        ['$', true],
        [1, 'Alice'],
        ['i', 's'],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND name = $2',
      args: [1, 'Alice'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
  ])
})

test('accepts compact native scalar arg types in compact template SQL queries', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND email = ', null],
        ['$', true],
        [1, 'alice@example.com'],
        [
          ['i', 'INTEGER'],
          ['s', 'TEXT'],
        ],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND email = $2',
      args: [1, 'alice@example.com'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int', dbType: 'INTEGER' },
        { arity: 'scalar', scalarType: 'string', dbType: 'TEXT' },
      ],
    },
  ])
})

test('accepts compact parameter fragments', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null, ' AND name = ', null],
        ['$', true],
        [1, 'Alice'],
        ['i', 's'],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND name = $2',
      args: [1, 'Alice'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
  ])
})

test('accepts compact Prisma value placeholders', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id = ', null],
        ['$', true],
        [{ $p: ['%1', 'Int'] }],
        ['i'],
        false,
      ] satisfies QueryPlanDbQuery,
      { '%1': 42 } as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1',
      args: [42],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
    },
  ])
})

test('converts compact DateTime placeholders to dates', () => {
  const date = '2024-01-01T00:00:00.000Z'
  expect(
    renderQuery(
      {
        type: 'rawSql',
        sql: 'SELECT * FROM users WHERE created_at = $1',
        args: [{ $p: ['%1', 'DateTime'] }],
        argTypes: [{ arity: 'scalar', scalarType: 'datetime' }],
      } satisfies QueryPlanDbQuery,
      { '%1': date } as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE created_at = $1',
      args: [new Date(date)],
      argTypes: [{ arity: 'scalar', scalarType: 'datetime' }],
    },
  ])
})

test('accepts compact parameter tuple fragments', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE id IN ', ['T', '', ',', '']],
        ['$', true],
        [[1, 2, 3]],
        ['i'],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id IN ($1,$2,$3)',
      args: [1, 2, 3],
      argTypes: Array.from({ length: 3 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('normalizes compact arg types in tuple arguments', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE (id, email) IN ', ['T', '', ',', '']],
        ['$', true],
        [[1, 'alice@example.com']],
        [
          {
            arity: 'tuple',
            elements: [
              ['i', 'INTEGER'],
              ['s', 'TEXT'],
            ],
          },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE (id, email) IN ($1,$2)',
      args: [1, 'alice@example.com'],
      argTypes: [
        { arity: 'scalar', scalarType: 'int', dbType: 'INTEGER' },
        { arity: 'scalar', scalarType: 'string', dbType: 'TEXT' },
      ],
    },
  ])
})

test('accepts compact parameter tuple list fragments', () => {
  expect(
    renderQuery(
      [
        ['INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ', ['L', '(', ',', ')', ',']],
        ['$', true],
        [
          [
            [1, 2],
            [3, 4],
          ],
        ],
        Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ($1,$2),($3,$4)',
      args: [1, 2, 3, 4],
      argTypes: Array.from({ length: 4 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('transforms IN template', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE "userId" IN ', ['T', '', ',', ''], ' OFFSET ', null],
        ['$', true],
        [[1, 2, 3], 0],
        [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'int' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) OFFSET $4',
      args: [1, 2, 3, 0],
      argTypes: Array.from({ length: 4 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('transforms IN template with empty list', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE "userId" IN ', ['T', '', ',', ''], ' OFFSET ', null],
        ['$', true],
        [[], 0],
        [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'int' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN (NULL) OFFSET $1',
      args: [0],
      argTypes: [{ arity: 'scalar', scalarType: 'int' }],
    },
  ])
})

test('handles singleton list in IN template', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE "userId" IN ', ['T', '', ',', ''], ' OFFSET ', null],
        ['$', true],
        [[1], 0],
        Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
      args: [1, 0],
      argTypes: Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('treats non-array element as a singleton list in IN template', () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE "userId" IN ', ['T', '', ',', ''], ' OFFSET ', null],
        ['$', true],
        [1, 0],
        Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
      args: [1, 0],
      argTypes: Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test("transforms IN template, doesn't touch scalar list", () => {
  expect(
    renderQuery(
      [
        ['SELECT * FROM users WHERE "userId" IN ', ['T', '', ',', ''], ' AND numbers = ', null, ' OFFSET ', null],
        ['$', true],
        [[1, 2, 3], [1, 2, 3], 0],
        [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'list', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'int' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) AND numbers = $4 OFFSET $5',
      args: [1, 2, 3, [1, 2, 3], 0],
      argTypes: [
        ...Array.from({ length: 3 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        { arity: 'list', scalarType: 'int' },
        { arity: 'scalar', scalarType: 'int' },
      ],
    },
  ])
})

test('transforms INSERT VALUES template', () => {
  expect(
    renderQuery(
      [
        ['INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ', ['L', '(', ',', ')', ',']],
        ['$', true],
        [
          [
            [1, 2],
            [3, 4],
          ],
        ],
        Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ($1,$2),($3,$4)',
      args: [1, 2, 3, 4],
      argTypes: Array.from({ length: 4 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('chunking an INSERT with a large parameterTupleList', () => {
  expect(
    renderQuery(
      [
        ['INSERT INTO "public"."Table" VALUES ', ['L', '(', ',', ')', ',']],
        ['$', true],
        [
          [
            Array.from({ length: 5 }, (_, i) => i + 1),
            Array.from({ length: 5 }, (_, i) => i + 6),
            Array.from({ length: 5 }, (_, i) => i + 11),
            Array.from({ length: 5 }, (_, i) => i + 16),
            Array.from({ length: 5 }, (_, i) => i + 21),
          ],
        ],
        Array.from({ length: 5 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){2}$/),
      args: Array.from({ length: 10 }, (_, i) => i + 1),
      argTypes: Array.from({ length: 10 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){2}$/),
      args: Array.from({ length: 10 }, (_, i) => i + 11),
      argTypes: Array.from({ length: 10 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){1}$/),
      args: Array.from({ length: 5 }, (_, i) => i + 21),
      argTypes: Array.from({ length: 5 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('chunking a UNION ALL with a large parameterTupleList', () => {
  expect(
    renderQuery(
      [
        [
          'SELECT * FROM [User] WHERE "banned" = ',
          null,
          ' AND "id" IN (SELECT ',
          ['L', '', ',', '', ' UNION ALL SELECT '],
          ') AND ("name" = ',
          null,
          ' OR "name" = ',
          null,
          ')',
        ],
        ['$', true],
        [false, Array.from({ length: 5 }, (_, i) => [i + 1, i + 2]), 'John Doe', 'Jane Doe'],
        [
          { arity: 'scalar', scalarType: 'boolean' },
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'string' },
          { arity: 'scalar', scalarType: 'string' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(
        /^SELECT \* FROM \[User\] WHERE "banned" = \$1 AND "id" IN \(SELECT ((\$[0-9]+,?){2}( UNION ALL SELECT )?){3}\) AND \("name" = \$8 OR "name" = \$9\)$/,
      ),
      args: [false, ...Array.from({ length: 3 }, (_, i) => [i + 1, i + 2]).flat(), 'John Doe', 'Jane Doe'],
      argTypes: [
        { arity: 'scalar', scalarType: 'boolean' },
        ...Array.from({ length: 6 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        { arity: 'scalar', scalarType: 'string' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
    {
      sql: expect.stringMatching(
        /^SELECT \* FROM \[User\] WHERE "banned" = \$1 AND "id" IN \(SELECT ((\$[0-9]+,?){2}( UNION ALL SELECT )?){2}\) AND \("name" = \$6 OR "name" = \$7\)$/,
      ),
      args: [false, ...Array.from({ length: 2 }, (_, i) => [i + 4, i + 5]).flat(), 'John Doe', 'Jane Doe'],
      argTypes: [
        { arity: 'scalar', scalarType: 'boolean' },
        ...Array.from({ length: 4 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        { arity: 'scalar', scalarType: 'string' },
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
  ])
})

test('chunking a SELECT..IN with a large parameterTuple', () => {
  expect(
    renderQuery(
      [
        [
          'SELECT FROM "public"."User" WHERE "banned" = ',
          null,
          ' AND "id" IN ',
          ['T', '', ',', ''],
          ' AND "name" = ',
          null,
        ],
        ['$', true],
        [false, Array.from({ length: 10 }, (_, i) => i + 1), 'John Doe'],
        [
          { arity: 'scalar', scalarType: 'boolean' },
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'string' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "banned" = \$1 AND "id" IN \((\$[0-9]+,?){8}\) AND "name" = \$10$/,
      ),
      args: [false, ...Array.from({ length: 8 }, (_, i) => i + 1), 'John Doe'],
      argTypes: [
        { arity: 'scalar', scalarType: 'boolean' },
        ...Array.from({ length: 8 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "banned" = \$1 AND "id" IN \((\$[0-9]+,?){2}\) AND "name" = \$4/,
      ),
      args: [false, ...Array.from({ length: 2 }, (_, i) => i + 9), 'John Doe'],
      argTypes: [
        { arity: 'scalar', scalarType: 'boolean' },
        ...Array.from({ length: 2 }, () => ({ arity: 'scalar', scalarType: 'int' })),
        { arity: 'scalar', scalarType: 'string' },
      ],
    },
  ])
})

test('chunking a SELECT..IN with multiple parameterTuples', () => {
  expect(
    renderQuery(
      [
        ['SELECT FROM "public"."User" WHERE "id" IN ', ['T', '', ',', ''], ' AND "age" IN ', ['T', '', ',', '']],
        ['$', true],
        [Array.from({ length: 10 }, (_, i) => i + 1), Array.from({ length: 4 }, (_, i) => i + 1)],
        [
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'int' },
        ],
        true,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "id" IN \((\$[0-9]+,?){6}\) AND "age" IN \((\$[0-9]+,?){4}\)$/,
      ),
      args: [...Array.from({ length: 6 }, (_, i) => i + 1), ...Array.from({ length: 4 }, (_, i) => i + 1)],
      argTypes: Array.from({ length: 10 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "id" IN \((\$[0-9]+,?){4}\) AND "age" IN \((\$[0-9]+,?){4}\)$/,
      ),
      args: [...Array.from({ length: 4 }, (_, i) => i + 7), ...Array.from({ length: 4 }, (_, i) => i + 1)],
      argTypes: Array.from({ length: 8 }, () => ({ arity: 'scalar', scalarType: 'int' })),
    },
  ])
})

test('a SELECT..IN with a large parameterTuple that is not chunkable', () => {
  expect(() =>
    renderQuery(
      [
        [
          'SELECT FROM "public"."User" WHERE "banned" = ',
          null,
          ' AND "id" IN ',
          ['T', '', ',', ''],
          ' AND "name" = ',
          null,
        ],
        ['$', true],
        [false, Array.from({ length: 3000 }, (_, i) => i + 1), 'John Doe'],
        [
          { arity: 'scalar', scalarType: 'boolean' },
          { arity: 'scalar', scalarType: 'int' },
          { arity: 'scalar', scalarType: 'string' },
        ],
        false,
      ] satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toThrowErrorMatchingInlineSnapshot(`
    [UserFacingError: The query parameter limit supported by your database is exceeded.]
  `)
})

test('executes a generator', () => {
  const generators = new GeneratorRegistry()
  expect(
    renderQuery(
      {
        type: 'rawSql',
        sql: 'INSERT INTO users (id, name) VALUES ($1, $2)',
        args: [{ $g: ['uuid', [4]] }, { $g: ['now', []] }],
        argTypes: [
          { arity: 'scalar', scalarType: 'datetime' },
          { arity: 'scalar', scalarType: 'datetime' },
        ],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      generators.snapshot(),
    ),
  ).toMatchObject([
    {
      sql: 'INSERT INTO users (id, name) VALUES ($1, $2)',
      args: [expect.any(String), expect.any(String)],
      argTypes: [
        { arity: 'scalar', scalarType: 'datetime' },
        { arity: 'scalar', scalarType: 'datetime' },
      ],
    },
  ])
})
