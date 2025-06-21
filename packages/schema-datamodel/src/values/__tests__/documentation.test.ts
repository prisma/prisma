import { expect, test } from 'vitest'

import { Documentation } from '../documentation'

test('creates single line documentation', () => {
  const docs = Documentation.create('This is a comment')
  expect(docs.toString()).toBe('/// This is a comment\n')
})

test('creates multi-line documentation', () => {
  const docs = Documentation.create('Line 1\nLine 2\nLine 3')
  expect(docs.toString()).toBe('/// Line 1\n/// Line 2\n/// Line 3\n')
})

test('handles empty lines in documentation', () => {
  const docs = Documentation.create('Line 1\n\nLine 3')
  expect(docs.toString()).toBe('/// Line 1\n///\n/// Line 3\n')
})

test('can add additional documentation', () => {
  const docs = Documentation.create('Line 1')
  docs.push('Line 2')
  docs.push('Line 3\nLine 4')
  expect(docs.toString()).toBe('/// Line 1\n/// Line 2\n/// Line 3\n/// Line 4\n')
})

test('returns content without comment markers', () => {
  const docs = Documentation.create('Line 1\nLine 2')
  expect(docs.getContent()).toBe('Line 1\nLine 2')
})
