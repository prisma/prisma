import { array } from './ArrayType'
import { functionType } from './FunctionType'
import { keyType } from './KeyType'
import { namedType } from './NamedType'
import { objectType } from './ObjectType'
import { stringify } from './stringify'
import { unionType } from './UnionType'

const A = namedType('A')
const B = namedType('B')
const C = namedType('C')

test('simple only', () => {
  expect(stringify(keyType(A, 'foo'))).toMatchInlineSnapshot(`A["foo"]`)
})

test('with object type', () => {
  expect(stringify(keyType(objectType(), 'toString'))).toMatchInlineSnapshot(`({})["toString"]`)
})

test('with array type', () => {
  expect(stringify(keyType(array(A), 'length'))).toMatchInlineSnapshot(`A[]["length"]`)
})

test('with function type', () => {
  expect(stringify(keyType(functionType(), 'length'))).toMatchInlineSnapshot(`(() => void)["length"]`)
})

test('with union type', () => {
  const union = unionType(A).addVariant(B).addVariant(C)
  expect(stringify(keyType(union, 'foo'))).toMatchInlineSnapshot(`(A | B | C)["foo"]`)
})
