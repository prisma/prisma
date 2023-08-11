import { functionType } from './FunctionType'
import { genericParameter } from './GenericParameter'
import { namedType } from './NamedType'
import { parameter } from './Parameter'
import { stringify } from './stringify'

const A = namedType('A')
const B = namedType('B')

test('basic', () => {
  expect(stringify(functionType())).toMatchInlineSnapshot(`() => void`)
})

test('with return type', () => {
  const func = functionType().setReturnType(A)
  expect(stringify(func)).toMatchInlineSnapshot(`() => A`)
})

test('with parameter', () => {
  const func = functionType().addParameter(parameter('param', A))
  expect(stringify(func)).toMatchInlineSnapshot(`(param: A) => void`)
})

test('with multiple parameters', () => {
  const func = functionType().addParameter(parameter('param1', A)).addParameter(parameter('param2', B))
  expect(stringify(func)).toMatchInlineSnapshot(`(param1: A, param2: B) => void`)
})

test('with generic parameter', () => {
  const func = functionType().addGenericParameter(genericParameter('T'))
  expect(stringify(func)).toMatchInlineSnapshot(`<T>() => void`)
})

test('with multiple generic parameters', () => {
  const func = functionType().addGenericParameter(genericParameter('T')).addGenericParameter(genericParameter('U'))
  expect(stringify(func)).toMatchInlineSnapshot(`<T, U>() => void`)
})
