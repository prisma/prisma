import { describe, expect, test } from 'vitest'

import { capitalize, lowerCase } from './casing'

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

describe('lowerCase', () => {
  test('empty', () => {
    expect(lowerCase('')).toBe('')
  })

  test('single character', () => {
    expect(lowerCase('A')).toBe('a')
  })

  test('multiple characters', () => {
    expect(lowerCase('Hello')).toBe('hello')
  })

  test('does not modify already lower case string', () => {
    expect(lowerCase('hello')).toBe('hello')
  })

  test('only lowercases the first character', () => {
    expect(lowerCase('HelloWorld')).toBe('helloWorld')
  })
})
