import { method } from './Method'
import { namedType } from './NamedType'
import { objectType } from './ObjectType'
import { property } from './Property'
import { stringify } from './stringify'

const A = namedType('A')

test('empty', () => {
  const obj = objectType()
  expect(stringify(obj)).toMatchInlineSnapshot(`{}`)
})

test('with property', () => {
  const obj = objectType().add(property('foo', A))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    {
      foo: A
    }
  `)
})

test('with method', () => {
  const obj = objectType().add(method('doThing'))
  expect(stringify(obj)).toMatchInlineSnapshot(`
    {
      doThing(): void
    }
  `)
})

test('inline formatting', () => {
  const obj = objectType().add(property('foo', A)).formatInline()
  expect(stringify(obj)).toMatchInlineSnapshot(`{ foo: A }`)
})
