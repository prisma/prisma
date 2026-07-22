import { expect, test } from 'vitest'

import type { QueryPlanNode } from '../query-plan'
import { getMaxStatementNodeCount } from './statement-count'

const executeNode: QueryPlanNode = {
  type: 'execute',
  args: {
    type: 'templateSql',
    fragments: [{ type: 'stringChunk', chunk: 'DELETE FROM "User"' }],
    placeholderFormat: { prefix: '$', hasNumbering: true },
    args: [],
    argTypes: [],
    chunkable: false,
  },
}

const queryNode: QueryPlanNode = {
  type: 'query',
  args: {
    type: 'rawSql',
    sql: 'SELECT 1',
    args: [],
    argTypes: [],
  },
}

test('counts a single statement node through wrapper nodes', () => {
  const plan: QueryPlanNode = {
    type: 'dataMap',
    args: {
      expr: { type: 'unique', args: queryNode },
      structure: { type: 'affectedRows' },
      enums: {},
    },
  }
  expect(getMaxStatementNodeCount(plan)).toBe(1)
})

test('sums statement nodes across sequential children', () => {
  const plan: QueryPlanNode = {
    type: 'let',
    args: {
      bindings: [{ name: 'a', expr: queryNode }],
      expr: { type: 'seq', args: [executeNode, { type: 'get', args: { name: 'a' } }] },
    },
  }
  expect(getMaxStatementNodeCount(plan)).toBe(2)
})

test('takes the maximum over mutually exclusive if branches', () => {
  const plan: QueryPlanNode = {
    type: 'if',
    args: {
      value: { type: 'value', args: 1 },
      rule: { type: 'rowCountEq', args: 1 },
      then: executeNode,
      else: queryNode,
    },
  }
  expect(getMaxStatementNodeCount(plan)).toBe(1)
})

test('treats nested transactions as unbounded', () => {
  const plan: QueryPlanNode = { type: 'transaction', args: executeNode }
  expect(getMaxStatementNodeCount(plan)).toBe(Infinity)
})
