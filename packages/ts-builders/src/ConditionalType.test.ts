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
const D = namedType('D')

test('basic conditional type', () => {
  const conditional = conditionalType().check(A).extends(B).then(C).else(D)

  expect(stringify(conditional)).toMatchInlineSnapshot(`"A extends B ? C : D"`)
})

test('with union type as check type', () => {
  const union = unionType(A).addVariant(B)
  const conditional = conditionalType().check(union).extends(C).then(namedType('true')).else(namedType('false'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"A | B extends C ? true : false"`)
})

test('with array type as extends type', () => {
  const conditional = conditionalType()
    .check(A)
    .extends(array(B))
    .then(namedType('IsArray'))
    .else(namedType('NotArray'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"A extends B[] ? IsArray : NotArray"`)
})

test('with object types', () => {
  const objType = objectType()
    .add(property('name', namedType('string')))
    .add(property('age', namedType('number')))

  const conditional = conditionalType()
    .check(A)
    .extends(objType)
    .then(namedType('IsObject'))
    .else(namedType('NotObject'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`
    "A extends {
      name: string
      age: number
    } ? IsObject : NotObject"
  `)
})

test('with function types', () => {
  const funcType = functionType()
    .addParameter(parameter('x', namedType('string')))
    .setReturnType(namedType('number'))

  const conditional = conditionalType()
    .check(A)
    .extends(funcType)
    .then(namedType('IsFunction'))
    .else(namedType('NotFunction'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"A extends (x: string) => number ? IsFunction : NotFunction"`)
})

test('nested conditional types', () => {
  const innerConditional = conditionalType().check(A).extends(B).then(C).else(D)

  const outerConditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('string'))
    .then(innerConditional)
    .else(namedType('never'))

  expect(stringify(outerConditional)).toMatchInlineSnapshot(`"T extends string ? A extends B ? C : D : never"`)
})

test('with generic types', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('U'))
    .then(namedType('T'))
    .else(namedType('never'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends U ? T : never"`)
})

test('complex real-world example', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(array(namedType('any')))
    .then(namedType('T[0]'))
    .else(namedType('T'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends any[] ? T[0] : T"`)
})

test('with literal types', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('"foo"'))
    .then(namedType('true'))
    .else(namedType('false'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends "foo" ? true : false"`)
})

test('with intersection types', () => {
  const intersection = intersectionType(A).addType(B)
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(intersection)
    .then(namedType('HasBoth'))
    .else(namedType('NotBoth'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends A & B ? HasBoth : NotBoth"`)
})

test('with tuple types', () => {
  const tupleType = namedType('[string, number]')
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(tupleType)
    .then(namedType('IsTuple'))
    .else(namedType('NotTuple'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends [string, number] ? IsTuple : NotTuple"`)
})

test('with keyof type', () => {
  const conditional = conditionalType()
    .check(namedType('K'))
    .extends(namedType('keyof T'))
    .then(namedType('K'))
    .else(namedType('never'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"K extends keyof T ? K : never"`)
})

test('with never type', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('never'))
    .then(namedType('NeverReached'))
    .else(namedType('NotNever'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends never ? NeverReached : NotNever"`)
})

test('with unknown type', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('unknown'))
    .then(namedType('AlwaysTrue'))
    .else(namedType('NeverReached'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends unknown ? AlwaysTrue : NeverReached"`)
})

test('with any type', () => {
  const conditional = conditionalType()
    .check(namedType('any'))
    .extends(namedType('T'))
    .then(namedType('AnyExtendsT'))
    .else(namedType('NotExtends'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"any extends T ? AnyExtendsT : NotExtends"`)
})

test('deeply nested conditional types', () => {
  const deeplyNested = conditionalType()
    .check(namedType('T'))
    .extends(namedType('string'))
    .then(
      conditionalType()
        .check(namedType('U'))
        .extends(namedType('number'))
        .then(
          conditionalType()
            .check(namedType('V'))
            .extends(namedType('boolean'))
            .then(namedType('AllMatch'))
            .else(namedType('VNotBoolean')),
        )
        .else(namedType('UNotNumber')),
    )
    .else(namedType('TNotString'))

  expect(stringify(deeplyNested)).toMatchInlineSnapshot(
    `"T extends string ? U extends number ? V extends boolean ? AllMatch : VNotBoolean : UNotNumber : TNotString"`,
  )
})

test('with template literal types', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('`prefix_${string}`'))
    .then(namedType('HasPrefix'))
    .else(namedType('NoPrefix'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends \`prefix_\${string}\` ? HasPrefix : NoPrefix"`)
})

test('with infer keyword', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('Promise<infer U>'))
    .then(namedType('U'))
    .else(namedType('never'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T extends Promise<infer U> ? U : never"`)
})

test('conditional type in union', () => {
  const conditional = conditionalType()
    .check(namedType('T'))
    .extends(namedType('string'))
    .then(namedType('A'))
    .else(namedType('B'))

  const union = unionType<TypeBuilder>(conditional).addVariant(namedType('C'))

  expect(stringify(union)).toMatchInlineSnapshot(`"(T extends string ? A : B) | C"`)
})

test('with mapped type notation', () => {
  const conditional = conditionalType()
    .check(namedType('T[K]'))
    .extends(namedType('Function'))
    .then(namedType('K'))
    .else(namedType('never'))

  expect(stringify(conditional)).toMatchInlineSnapshot(`"T[K] extends Function ? K : never"`)
})
