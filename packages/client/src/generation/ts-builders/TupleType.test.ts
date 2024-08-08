import { namedType } from './NamedType'
import { stringify } from './stringify'
import { tupleItem, tupleType } from './TupleType'

test('empty', () => {
  const tuple = tupleType()
  expect(stringify(tuple)).toMatchInlineSnapshot(`"[]"`)
})

test('one item', () => {
  const tuple = tupleType().add(namedType('A'))
  expect(stringify(tuple)).toMatchInlineSnapshot(`"[A]"`)
})

test('with named item', () => {
  const tuple = tupleType().add(tupleItem(namedType('A')).setName('foo'))
  expect(stringify(tuple)).toMatchInlineSnapshot(`"[foo: A]"`)
})

test('multiple items', () => {
  const tuple = tupleType().add(namedType('A')).add(namedType('B')).add(namedType('C'))
  expect(stringify(tuple)).toMatchInlineSnapshot(`"[A, B, C]"`)
})
