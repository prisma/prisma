import { genericParameter } from './GenericParameter'
import { namedType } from './NamedType'
import { stringify } from './stringify'

const A = namedType('A')
const B = namedType('B')

test('name only', () => {
  expect(stringify(genericParameter('T'))).toMatchInlineSnapshot(`T`)
})

test('with extends', () => {
  expect(stringify(genericParameter('T').extends(A))).toMatchInlineSnapshot(`T extends A`)
})

test('with default', () => {
  expect(stringify(genericParameter('T').default(B))).toMatchInlineSnapshot(`T = B`)
})

test('with extends + default', () => {
  expect(stringify(genericParameter('T').extends(A).default(B))).toMatchInlineSnapshot(`T extends A = B`)
})
