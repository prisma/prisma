import { array } from './ArrayType'
import { functionType } from './FunctionType'
import { namedType } from './NamedType'
import { objectType } from './ObjectType'
import { stringify } from './stringify'
import { unionType } from './UnionType'

const A = namedType('A')
const B = namedType('B')
const C = namedType('C')

test('simple only', () => {
  expect(stringify(array(A))).toMatchInlineSnapshot(`"A[]"`)
})

test('with object type', () => {
  expect(stringify(array(objectType()))).toMatchInlineSnapshot(`"({})[]"`)
})

test('with function type', () => {
  expect(stringify(array(functionType()))).toMatchInlineSnapshot(`"(() => void)[]"`)
})

test('with union type', () => {
  const union = unionType(A).addVariant(B).addVariant(C)
  expect(stringify(array(union))).toMatchInlineSnapshot(`"(A | B | C)[]"`)
})

test('readonly array type', () => {
  expect(stringify(array(A).readonly())).toMatchInlineSnapshot(`"readonly A[]"`)
})

test('readonly array of object type', () => {
  expect(stringify(array(objectType()).readonly())).toMatchInlineSnapshot(`"readonly ({})[]"`)
})

test('readonly array of function type', () => {
  expect(stringify(array(functionType()).readonly())).toMatchInlineSnapshot(`"readonly (() => void)[]"`)
})

test('readonly array of union type', () => {
  const union = unionType(A).addVariant(B).addVariant(C)
  expect(stringify(array(union).readonly())).toMatchInlineSnapshot(`"readonly (A | B | C)[]"`)
})
