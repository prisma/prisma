import { expect, test } from 'vitest'
import { Function } from '../function'
import { Value } from '../value'

test('creates function with no parameters', () => {
  const func = Function.create('uuid')
  expect(func.toString()).toBe('uuid')
  expect(func.getName()).toBe('uuid')
})

test('creates function with empty parentheses', () => {
  const func = Function.create('autoincrement')
  func.setRenderEmptyParentheses(true)
  expect(func.toString()).toBe('autoincrement()')
})

test('creates function with single parameter', () => {
  const func = Function.create('map')
  func.pushParam('user_id')
  expect(func.toString()).toBe('map("user_id")')
})

test('creates function with multiple parameters', () => {
  const func = Function.create('relation')
  func.pushParam('fields', Value.array([Value.text('userId')]))
  func.pushParam('references', Value.array([Value.text('id')]))
  expect(func.toString()).toBe('relation(fields: ["userId"], references: ["id"])')
})

test('creates function with mixed parameter types', () => {
  const func = Function.create('index')
  func.pushParam(Value.array([Value.text('name'), Value.text('email')]))
  func.pushParam('type', 'BTree')
  expect(func.toString()).toBe('index(["name", "email"], type: "BTree")')
})

test('handles string parameter shortcuts', () => {
  const func = Function.create('map')
  func.pushParam('table_name')
  expect(func.toString()).toBe('map("table_name")')
})

test('handles number parameter shortcuts', () => {
  const func = Function.create('length')
  func.pushParam(255)
  expect(func.toString()).toBe('length(255)')
})

test('handles boolean parameter shortcuts', () => {
  const func = Function.create('clustered')
  func.pushParam(false)
  expect(func.toString()).toBe('clustered(false)')
})