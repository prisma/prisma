import type { PlaceholderFormat, QueryPlanDbQuery } from '../QueryPlan'
import { GeneratorRegistry } from './generators'
import { renderQuery } from './renderQuery'
import { ScopeBindings } from './scope'

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
  ).toEqual({
    sql: 'SELECT * FROM users WHERE id = $1',
    args: [1],
    argTypes: ['Numeric'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE id = $1 AND numbers = $2',
    args: [1, [1, 2, 3]],
    argTypes: ['Numeric', 'Array'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) OFFSET $4',
    args: [1, 2, 3, 0],
    argTypes: ['Numeric', 'Numeric', 'Numeric', 'Numeric'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN (NULL) OFFSET $1',
    args: [0],
    argTypes: ['Numeric'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
    args: [1, 0],
    argTypes: ['Numeric', 'Numeric'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2',
    args: [1, 0],
    argTypes: ['Numeric', 'Numeric'],
  })
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) AND numbers = $4 OFFSET $5',
    args: [1, 2, 3, [1, 2, 3], 0],
    argTypes: ['Numeric', 'Numeric', 'Numeric', 'Array', 'Numeric'],
  })
})

test('transforms INSERT VALUES template', () => {
  expect(
    renderQuery(
      {
        type: 'templateSql',
        fragments: [
          { type: 'stringChunk', chunk: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ' },
          { type: 'parameterTupleList', itemPrefix: '(', itemSeparator: ',', itemSuffix: ')', groupSeparator: ',' },
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
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
      {},
    ),
  ).toEqual({
    sql: 'INSERT INTO "public"."_CategoryToPost" ("A", "B") VALUES ($1,$2),($3,$4)',
    args: [1, 2, 3, 4],
    argTypes: ['Numeric', 'Numeric', 'Numeric', 'Numeric'],
  })
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
  ).toMatchObject({
    sql: 'INSERT INTO users (id, name) VALUES ($1, $2)',
    args: [expect.any(String), expect.any(String)],
    argTypes: ['Text', 'Text'],
  })
})
