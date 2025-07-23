import { expect, test } from 'vitest'

import { array } from './ArrayType'
import { conditionalType } from './ConditionalType'
import { functionType } from './FunctionType'
import { intersectionType } from './IntersectionType'
import { namedType } from './NamedType'
import { objectType } from './ObjectType'
import { parameter } from './Parameter'
import { property } from './Property'
import { stringify } from './stringify'
import { TypeBuilder } from './TypeBuilder'
import { unionType } from './UnionType'

const A = namedType('A')
const B = namedType('B')
const C = namedType('C')

test('one type', () => {
  expect(stringify(intersectionType(A))).toMatchInlineSnapshot(`"A"`)
})

test('multiple types', () => {
  expect(stringify(intersectionType(A).addType(B))).toMatchInlineSnapshot(`"A & B"`)
})

test('three types', () => {
  expect(stringify(intersectionType(A).addType(B).addType(C))).toMatchInlineSnapshot(`"A & B & C"`)
})

test('from array', () => {
  expect(stringify(intersectionType([A, B, C]))).toMatchInlineSnapshot(`"A & B & C"`)
})

test('with function type', () => {
  const funcType = functionType()
    .addParameter(parameter('x', namedType('string')))
    .setReturnType(namedType('void'))

  expect(stringify(intersectionType([A, B, funcType]))).toMatchInlineSnapshot(`"A & B & ((x: string) => void)"`)
})

test('with object types', () => {
  const obj1 = objectType().add(property('name', namedType('string')))
  const obj2 = objectType().add(property('age', namedType('number')))

  const intersection = intersectionType(obj1).addType(obj2)

  expect(stringify(intersection)).toMatchInlineSnapshot(`
    "{
      name: string
    } & {
      age: number
    }"
  `)
})

test('with array types', () => {
  const intersection = intersectionType(array(A)).addType(array(B))
  expect(stringify(intersection)).toMatchInlineSnapshot(`"A[] & B[]"`)
})

test('with union types', () => {
  const union1 = unionType(A).addVariant(B)
  const union2 = unionType(C).addVariant(namedType('D'))

  const intersection = intersectionType(union1).addType(union2)
  expect(stringify(intersection)).toMatchInlineSnapshot(`"(A | B) & (C | D)"`)
})

test('fails with empty array', () => {
  expect(() => intersectionType([])).toThrowErrorMatchingInlineSnapshot(
    `[TypeError: Intersection types array can not be empty]`,
  )
})

test('mapTypes', () => {
  const intersection = intersectionType([A, B, C]).mapTypes(array)
  expect(stringify(intersection)).toMatchInlineSnapshot(`"A[] & B[] & C[]"`)
})

test('with generic types', () => {
  const intersection = intersectionType(namedType('T')).addType(namedType('U'))
  expect(stringify(intersection)).toMatchInlineSnapshot(`"T & U"`)
})

test('with literal types', () => {
  const intersection = intersectionType(namedType('"foo"')).addType(namedType('"bar"'))
  expect(stringify(intersection)).toMatchInlineSnapshot(`""foo" & "bar""`)
})

test('nested intersection types', () => {
  const inner = intersectionType(A).addType(B)
  const outer = intersectionType<TypeBuilder>(inner).addType(C)
  expect(stringify(outer)).toMatchInlineSnapshot(`"A & B & C"`)
})

test('with conditional type', () => {
  const conditional = conditionalType().check(namedType('T')).extends(namedType('string')).then(A).else(B)

  const intersection = intersectionType<TypeBuilder>(conditional).addType(C)
  expect(stringify(intersection)).toMatchInlineSnapshot(`"(T extends string ? A : B) & C"`)
})

test('with keyof type', () => {
  const intersection = intersectionType(namedType('keyof T')).addType(namedType('string'))
  expect(stringify(intersection)).toMatchInlineSnapshot(`"keyof T & string"`)
})

test('complex real-world example', () => {
  const baseType = objectType()
    .add(property('id', namedType('string')))
    .add(property('createdAt', namedType('Date')))

  const userFields = objectType()
    .add(property('name', namedType('string')))
    .add(property('email', namedType('string')))

  const permissions = objectType().add(
    property('role', unionType(namedType('"admin"')).addVariant(namedType('"user"'))),
  )

  const userType = intersectionType(baseType).addType(userFields).addType(permissions)

  expect(stringify(userType)).toMatchInlineSnapshot(`
    "{
      id: string
      createdAt: Date
    } & {
      name: string
      email: string
    } & {
      role: "admin" | "user"
    }"
  `)
})

test('addTypes with multiple types', () => {
  const intersection = intersectionType(A).addTypes([B, C])
  expect(stringify(intersection)).toMatchInlineSnapshot(`"A & B & C"`)
})

test('with never type', () => {
  const intersection = intersectionType(A).addType(namedType('never'))
  expect(stringify(intersection)).toMatchInlineSnapshot(`"A & never"`)
})

test('with unknown type', () => {
  const intersection = intersectionType(A).addType(namedType('unknown'))
  expect(stringify(intersection)).toMatchInlineSnapshot(`"A & unknown"`)
})

test('with any type', () => {
  const intersection = intersectionType(namedType('any')).addType(B)
  expect(stringify(intersection)).toMatchInlineSnapshot(`"any & B"`)
})
