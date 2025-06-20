import { expect, test } from 'vitest'
import { Text } from '../text'

test('creates quoted text value', () => {
  const text = Text.create('hello world')
  expect(text.toString()).toBe('"hello world"')
  expect(text.getValue()).toBe('hello world')
})

test('escapes quotes in text', () => {
  const text = Text.create('hello "world"')
  expect(text.toString()).toBe('"hello \\"world\\""')
})

test('escapes backslashes in text', () => {
  const text = Text.create('hello\\world')
  expect(text.toString()).toBe('"hello\\\\world"')
})

test('escapes newlines in text', () => {
  const text = Text.create('hello\nworld')
  expect(text.toString()).toBe('"hello\\nworld"')
})

test('escapes carriage returns in text', () => {
  const text = Text.create('hello\rworld')
  expect(text.toString()).toBe('"hello\\rworld"')
})

test('escapes tabs in text', () => {
  const text = Text.create('hello\tworld')
  expect(text.toString()).toBe('"hello\\tworld"')
})