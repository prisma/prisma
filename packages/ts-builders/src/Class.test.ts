import { expect, test } from 'vitest'

import { classDeclaration } from './Class'
import { genericParameter } from './GenericParameter'
import { method } from './Method'
import { namedType } from './NamedType'
import { property } from './Property'
import { stringify } from './stringify'

const A = namedType('A')

test('empty', () => {
  const obj = classDeclaration('MyClass')
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class MyClass {}
    "
  `)
})

test('with property', () => {
  const obj = classDeclaration('SomeClass').add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class SomeClass {
      foo: A
    }"
  `)
})

test('with method', () => {
  const obj = classDeclaration('MyClass').add(method('doThing'))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class MyClass {
      doThing(): void
    }"
  `)
})

test('with generic parameter', () => {
  const obj = classDeclaration('SomeClass')
    .addGenericParameter(genericParameter('T').extends(namedType('U')))
    .add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class SomeClass<T extends U> {
      foo: A
    }"
  `)
})

test('extending the type', () => {
  const obj = classDeclaration('SomeClass').extends(namedType('Foo')).add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class SomeClass extends Foo {
      foo: A
    }"
  `)
})

test('extending multiple types', () => {
  const obj = classDeclaration('SomeClass').extends(namedType('Foo')).extends(namedType('Bar')).add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    "class SomeClass extends Foo, Bar {
      foo: A
    }"
  `)
})
