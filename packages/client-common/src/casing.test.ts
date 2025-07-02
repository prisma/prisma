import { describe, expect, test } from 'vitest'

import { capitalize, uncapitalize } from './casing'

describe('capitalize', () => {
  test('empty', () => {
    expect(capitalize('')).toBe('')
  })

  test('single character', () => {
    expect(capitalize('a')).toBe('A')
  })

  test('multiple characters', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  test('does not modify already capitalized string', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })
})

describe('uncapitalize', () => {
  test('empty', () => {
    expect(uncapitalize('')).toBe('')
  })

  test('single character', () => {
    expect(uncapitalize('A')).toBe('a')
  })

  test('multiple characters', () => {
    expect(uncapitalize('Hello')).toBe('hello')
  })

  test('does not modify already lower case string', () => {
    expect(uncapitalize('hello')).toBe('hello')
  })

  test('only lowercases the first character', () => {
    expect(uncapitalize('HelloWorld')).toBe('helloWorld')
  })
})
