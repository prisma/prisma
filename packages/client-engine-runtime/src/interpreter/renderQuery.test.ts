import { PlaceholderFormat, QueryPlanDbQuery } from '../QueryPlan'
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE id = ' },
          { type: 'parameter' },
          { type: 'stringChunk', value: ' AND numbers = ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [1, [1, 2, 3]],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', value: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [[1, 2, 3], 0],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', value: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [[], 0],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', value: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [[1], 0],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', value: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [1, 0],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
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
          { type: 'stringChunk', value: 'SELECT * FROM users WHERE "userId" IN ' },
          { type: 'parameterTuple' },
          { type: 'stringChunk', value: ' AND numbers = ' },
          { type: 'parameter' },
          { type: 'stringChunk', value: ' OFFSET ' },
          { type: 'parameter' },
        ],
        placeholder: {
          prefix: '$',
          hasNumbering: true,
        } as PlaceholderFormat,
        params: [[1, 2, 3], [1, 2, 3], 0],
      } satisfies QueryPlanDbQuery,
      {} as ScopeBindings,
    ),
  ).toEqual({
    sql: 'SELECT * FROM users WHERE "userId" IN ($1,$2,$3) AND numbers = $4 OFFSET $5',
    args: [1, 2, 3, [1, 2, 3], 0],
    argTypes: ['Numeric', 'Numeric', 'Numeric', 'Array', 'Numeric'],
  })
})
