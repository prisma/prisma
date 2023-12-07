import { namedType } from './NamedType'
import { stringify } from './stringify'

test('name only', () => {
  expect(stringify(namedType('MyType'))).toMatchInlineSnapshot(`MyType`)
})

test('with generic argument', () => {
  expect(stringify(namedType('MyType').addGenericArgument(namedType('Foo')))).toMatchInlineSnapshot(`MyType<Foo>`)
})

test('with multiple generic arguments', () => {
  expect(
    stringify(namedType('MyType').addGenericArgument(namedType('Foo')).addGenericArgument(namedType('Bar'))),
  ).toMatchInlineSnapshot(`MyType<Foo, Bar>`)
})
