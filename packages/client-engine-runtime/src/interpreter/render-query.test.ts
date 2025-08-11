import type { PlaceholderFormat, QueryPlanDbQuery } from '../query-plan'
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
        params: [1],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1',
      args: [1],
      argTypes: ['Numeric'],
    },
  ])
})

test('no template and scalar list parameter', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE id = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' AND numbers = ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [1, [1, 2, 3]],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE id = $1 AND numbers = $2',
      args: [1, [1, 2, 3]],
      argTypes: ['Numeric', 'Array'],
    },
  ])
})

test('transforms IN template', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [[1, 2, 3], 0],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) OFFSET $4',
      args: [1, 2, 3, 0],
      argTypes: ['Numeric', 'Numeric', 'Numeric', 'Numeric'],
    },
  ])
})

test('transforms IN template with empty list', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [[], 0],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN (NULL) OFFSET $1',
      args: [0],
      argTypes: ['Numeric'],
    },
  ])
})

test('handles singleton list in IN template', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [[1], 0],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
      args: [1, 0],
      argTypes: ['Numeric', 'Numeric'],
    },
  ])
})

test('treats non-array element as a singleton list in IN template', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [1, 0],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
      args: [1, 0],
      argTypes: ['Numeric', 'Numeric'],
    },
  ])
})

test("transforms IN template, doesn't touch scalar list", () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' AND numbers = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [[1, 2, 3], [1, 2, 3], 0],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) AND numbers = $4 OFFSET $5',
      args: [1, 2, 3, [1, 2, 3], 0],
      argTypes: ['Numeric', 'Numeric', 'Numeric', 'Array', 'Numeric'],
    },
  ])
})

test('transforms INSERT VALUES template', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ' },
          {
            type: 'parameterTupleList',
            itemPrefix: '(',
            itemSeparator: ',',
            itemSuffix: ')',
            groupSeparator: ',',
          },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [
          [
            [1, 2],
            [3, 4],
          ],
        ],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual([
    {
      sql: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ($1,$2),($3,$4)',
      args: [1, 2, 3, 4],
      argTypes: ['Numeric', 'Numeric', 'Numeric', 'Numeric'],
    },
  ])
})

test('chunking an INSERT with a large parameterTupleList', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'INSERT INTO "public"."Table" VALUES ' },
          {
            type: 'parameterTupleList',
            itemPrefix: '(',
            itemSeparator: ',',
            itemSuffix: ')',
            groupSeparator: ',',
          },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [
          [
            Array.from({ length: 5 }, (_, i) => i + 1),
            Array.from({ length: 5 }, (_, i) => i + 6),
            Array.from({ length: 5 }, (_, i) => i + 11),
            Array.from({ length: 5 }, (_, i) => i + 16),
            Array.from({ length: 5 }, (_, i) => i + 21),
          ],
        ],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){2}$/),
      args: Array.from({ length: 10 }, (_, i) => i + 1),
      argTypes: Array.from({ length: 10 }, () => 'Numeric'),
    },
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){2}$/),
      args: Array.from({ length: 10 }, (_, i) => i + 11),
      argTypes: Array.from({ length: 10 }, () => 'Numeric'),
    },
    {
      sql: expect.stringMatching(/^INSERT INTO "public"\."Table" VALUES (\((\$[0-9]+,?){5}\),?){1}$/),
      args: Array.from({ length: 5 }, (_, i) => i + 21),
      argTypes: Array.from({ length: 5 }, () => 'Numeric'),
    },
  ])
})

test('chunking a UNION ALL with a large parameterTupleList', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT * FROM [User] WHERE "banned" = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' AND "id" IN (SELECT ' },
          {
            type: 'parameterTupleList',
            itemPrefix: '',
            itemSeparator: ',',
            itemSuffix: '',
            groupSeparator: ' UNION ALL SELECT ',
          },
          { type: 'stringChunk', chunk: ') AND ("name" = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' OR "name" = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ')' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [false, Array.from({ length: 5 }, (_, i) => [i + 1, i + 2]), 'John Doe', 'Jane Doe'],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
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
      argTypes: ['Boolean', ...Array.from({ length: 6 }, () => 'Numeric'), 'Text', 'Text'],
    },
    {
      sql: expect.stringMatching(
        /^SELECT \* FROM \[User\] WHERE "banned" = \$1 AND "id" IN \(SELECT ((\$[0-9]+,?){2}( UNION ALL SELECT )?){2}\) AND \("name" = \$6 OR "name" = \$7\)$/,
      ),
      args: [false, ...Array.from({ length: 2 }, (_, i) => [i + 4, i + 5]).flat(), 'John Doe', 'Jane Doe'],
      argTypes: ['Boolean', ...Array.from({ length: 4 }, () => 'Numeric'), 'Text', 'Text'],
    },
  ])
})

test('chunking a SELECT..IN with a large parameterTuple', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT FROM "public"."User" WHERE "banned" = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' AND "id" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' AND "name" = ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [false, Array.from({ length: 10 }, (_, i) => i + 1), 'John Doe'],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
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
      argTypes: ['Boolean', ...Array.from({ length: 8 }, () => 'Numeric'), 'Text'],
    },
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "banned" = \$1 AND "id" IN \((\$[0-9]+,?){2}\) AND "name" = \$4/,
      ),
      args: [false, ...Array.from({ length: 2 }, (_, i) => i + 9), 'John Doe'],
      argTypes: ['Boolean', ...Array.from({ length: 2 }, () => 'Numeric'), 'Text'],
    },
  ])
})

test('chunking a SELECT..IN with multiple parameterTuples', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT FROM "public"."User" WHERE "id" IN ' },
          {
            type: 'parameterTuple',
          },
          { type: 'stringChunk', chunk: ' AND "age" IN ' },
          { type: 'parameterTuple' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [Array.from({ length: 10 }, (_, i) => i + 1), Array.from({ length: 4 }, (_, i) => i + 1)],
        chunkable: true,
      } satisfies QueryPlanDbQuery,
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
      argTypes: Array.from({ length: 10 }, () => 'Numeric'),
    },
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "id" IN \((\$[0-9]+,?){4}\) AND "age" IN \((\$[0-9]+,?){4}\)$/,
      ),
      args: [...Array.from({ length: 4 }, (_, i) => i + 7), ...Array.from({ length: 4 }, (_, i) => i + 1)],
      argTypes: Array.from({ length: 8 }, () => 'Numeric'),
    },
  ])
})

test('a SELECT..IN with a large parameterTuple that is not chunkable', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'SELECT FROM "public"."User" WHERE "banned" = ' },
          { type: 'parameter' },
          { type: 'stringChunk', chunk: ' AND "id" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', chunk: ' AND "name" = ' },
          { type: 'parameter' },
        ],
        placeholderFormat: {
          prefix: '$',
          hasNumbering: true,
        } satisfies PlaceholderFormat,
        params: [false, Array.from({ length: 3000 }, (_, i) => i + 1), 'John Doe'],
        chunkable: false,
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
      TEST_MAX_CHUNK_SIZE,
    ),
  ).toMatchObject([
    {
      sql: expect.stringMatching(
        /^SELECT FROM "public"\."User" WHERE "banned" = \$1 AND "id" IN \((\$[0-9]+,?){3000}\) AND "name" = \$3002$/,
      ),
      args: [false, ...Array.from({ length: 3000 }, (_, i) => i + 1), 'John Doe'],
      argTypes: ['Boolean', ...Array.from({ length: 3000 }, () => 'Numeric'), 'Text'],
    },
  ])
})

test('executes a generator', () => {
  const generators = new GeneratorRegistry()
  expect(
    renderQuery(
      {
        type: 'rawSql',
        sql: 'INSERT INTO users (id, name) VALUES ($1, $2)',
        params: [
          { prisma__type: 'generatorCall', prisma__value: { name: 'uuid', args: [4] } },
          { prisma__type: 'generatorCall', prisma__value: { name: 'now', args: [] } },
        ],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      generators.snapshot(),
    ),
  ).toMatchObject([
    {
      sql: 'INSERT INTO users (id, name) VALUES ($1, $2)',
      args: [expect.any(String), expect.any(String)],
      argTypes: ['Text', 'Text'],
    },
  ])
})
