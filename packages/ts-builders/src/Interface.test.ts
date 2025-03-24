import { expect, test } from 'vitest'

import { genericParameter } from './GenericParameter'
import { interfaceDeclaration } from './Interface'
import { method } from './Method'
import { namedType } from './NamedType'
import { property } from './Property'
import { stringify } from './stringify'

const A = namedType('A')

test('empty', () => {
  const obj = interfaceDeclaration('MyInterface')
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface MyInterface {}
    "
  `)
})

test('with property', () => {
  const obj = interfaceDeclaration('SomeInterface').add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface SomeInterface {
      foo: A
    }"
  `)
})

test('with method', () => {
  const obj = interfaceDeclaration('MyInterface').add(method('doThing'))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface MyInterface {
      doThing(): void
    }"
  `)
})

test('with generic parameter', () => {
  const obj = interfaceDeclaration('SomeInterface')
    .addGenericParameter(genericParameter('T').extends(namedType('U')))
    .add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface SomeInterface<T extends U> {
      foo: A
    }"
  `)
})

test('extending the type', () => {
  const obj = interfaceDeclaration('SomeInterface').extends(namedType('Foo')).add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface SomeInterface extends Foo {
      foo: A
    }"
  `)
})

test('extending multiple types', () => {
  const obj = interfaceDeclaration('SomeInterface')
    .extends(namedType('Foo'))
    .extends(namedType('Bar'))
    .add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "interface SomeInterface extends Foo, Bar {
      foo: A
    }"
  `)
})
