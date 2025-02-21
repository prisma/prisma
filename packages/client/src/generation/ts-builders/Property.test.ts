import { docComment } from './DocComment'
import { namedType } from './NamedType'
import { property } from './Property'
import { stringify } from './stringify'
import { toStringTag } from './WellKnownSymbol'

const A = namedType('A')

test('name and type', () => {
  const prop = property('foo', A)

  expect(stringify(prop)).toMatchInlineSnapshot(`"foo: A"`)
})

test('invalid identifier', () => {
  const prop = property('this is not a valid JS identifier', A)

  expect(stringify(prop)).toMatchInlineSnapshot(`"["this is not a valid JS identifier"]: A"`)
})

test('well-known symbol', () => {
  const prop = property(toStringTag, A)

  expect(stringify(prop)).toMatchInlineSnapshot(`"[Symbol.toStringTag]: A"`)
})

test('optional', () => {
  const prop = property('foo', A).optional()

  expect(stringify(prop)).toMatchInlineSnapshot(`"foo?: A"`)
})

test('readonly', () => {
  const prop = property('foo', A).readonly()

  expect(stringify(prop)).toMatchInlineSnapshot(`"readonly foo: A"`)
})

test('with doc comment', () => {
  const prop = property('foo', A).setDocComment(docComment('This is foo'))

  expect(stringify(prop)).toMatchInlineSnapshot(`
    "/**
     * This is foo
     */
    foo: A"
  `)
})
