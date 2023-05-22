import { docComment } from './DocComment'
import { genericParameter } from './GenericParameter'
import { method } from './Method'
import { namedType } from './NamedType'
import { parameter } from './Parameter'
import { stringify } from './stringify'

const A = namedType('A')
const B = namedType('B')

test('name only', () => {
  const m = method('doThings')
  expect(stringify(m)).toMatchInlineSnapshot(`doThings(): void`)
})

test('with return type', () => {
  const m = method('doThings').setReturnType(A)
  expect(stringify(m)).toMatchInlineSnapshot(`doThings(): A`)
})

test('with doc comment', () => {
  const m = method('doThings').setDocComment(docComment('Does things'))
  expect(stringify(m)).toMatchInlineSnapshot(`
    /**
     * Does things
     */
    doThings(): void
  `)
})

test('with parameter', () => {
  const m = method('doThings').addParameter(parameter('foo', A))
  expect(stringify(m)).toMatchInlineSnapshot(`doThings(foo: A): void`)
})

test('with multiple parameters', () => {
  const m = method('doThings').addParameter(parameter('foo', A)).addParameter(parameter('foo', B))
  expect(stringify(m)).toMatchInlineSnapshot(`doThings(foo: A, foo: B): void`)
})

test('with generic parameter', () => {
  const m = method('doThings').addGenericParameter(genericParameter('T'))
  expect(stringify(m)).toMatchInlineSnapshot(`doThings<T>(): void`)
})

test('with multiple generic parameters', () => {
  const m = method('doThings').addGenericParameter(genericParameter('T')).addGenericParameter(genericParameter('U'))
  expect(stringify(m)).toMatchInlineSnapshot(`doThings<T, U>(): void`)
})
