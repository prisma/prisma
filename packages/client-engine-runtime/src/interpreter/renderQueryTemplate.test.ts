import { renderQueryTemplate } from './renderQueryTemplate'

test('no template', () => {
  expect(
    renderQueryTemplate({
      query: 'SELECT * FROM users WHERE id = $1',
      params: [1],
    }),
  ).toEqual({
    query: 'SELECT * FROM users WHERE id = $1',
    params: [1],
  })
})

test('no template and scalar list parameter', () => {
  expect(
    renderQueryTemplate({
      query: 'SELECT * FROM users WHERE id = $1 AND numbers = $2',
      params: [1, [1, 2, 3]],
    }),
  ).toEqual({
    query: 'SELECT * FROM users WHERE id = $1 AND numbers = $2',
    params: [1, [1, 2, 3]],
  })
})

test('transforms IN template', () => {
  expect(
    renderQueryTemplate({
      query: `SELECT * FROM users WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ OFFSET $2`,
      params: [[1, 2, 3], 0],
    }),
  ).toEqual({
    query: `SELECT * FROM users WHERE "userId" IN ($1, $2, $3) OFFSET $4`,
    params: [1, 2, 3, 0],
  })
})

test('transforms IN template with empty list', () => {
  expect(
    renderQueryTemplate({
      query: `SELECT * FROM users WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ OFFSET $2`,
      params: [[], 0],
    }),
  ).toEqual({
    query: `SELECT * FROM users WHERE "userId" IN (NULL) OFFSET $1`,
    params: [0],
  })
})

test('handles singleton list in IN template', () => {
  expect(
    renderQueryTemplate({
      query: `SELECT * FROM users WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ OFFSET $2`,
      params: [[1], 0],
    }),
  ).toEqual({
    query: `SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2`,
    params: [1, 0],
  })
})

test('treats non-array element as a singleton list in IN template', () => {
  expect(
    renderQueryTemplate({
      query: `SELECT * FROM users WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ OFFSET $2`,
      params: [1, 0],
    }),
  ).toEqual({
    query: `SELECT * FROM users WHERE "userId" IN ($1) OFFSET $2`,
    params: [1, 0],
  })
})

test("transforms IN template, doesn't touch scalar list", () => {
  expect(
    renderQueryTemplate({
      query: `SELECT * FROM users WHERE "userId" IN /* prisma-comma-repeatable-start */$1/* prisma-comma-repeatable-end */ AND numbers = $2 OFFSET $3`,
      params: [[1, 2, 3], [1, 2, 3], 0],
    }),
  ).toEqual({
    query: `SELECT * FROM users WHERE "userId" IN ($1, $2, $3) AND numbers = $4 OFFSET $5`,
    params: [1, 2, 3, [1, 2, 3], 0],
  })
})

test('ignores special characters in quotes', () => {
  expect(
    renderQueryTemplate({
      query: `SELECT id AS "user$id" FROM users WHERE id = $1`,
      params: [1],
    }),
  ).toEqual({
    query: `SELECT id AS "user$id" FROM users WHERE id = $1`,
    params: [1],
  })
})
