import { expect, test } from 'vitest'
import { Constant } from '../constant'

test('creates constant with string value', () => {
  const constant = Constant.create('User')
  expect(constant.toString()).toBe('User')
  expect(constant.getValue()).toBe('User')
})

test('creates constant with number value', () => {
  const constant = Constant.create(42)
  expect(constant.toString()).toBe('42')
  expect(constant.getValue()).toBe(42)
})

test('creates constant with boolean value', () => {
  const constant = Constant.create(true)
  expect(constant.toString()).toBe('true')
  expect(constant.getValue()).toBe(true)
})