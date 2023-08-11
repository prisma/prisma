import { namedType } from './NamedType'
import { parameter } from './Parameter'
import { stringify } from './stringify'

const A = namedType('A')

test('name and type', () => {
  const param = parameter('foo', A)

  expect(stringify(param)).toMatchInlineSnapshot(`foo: A`)
})

test('optional', () => {
  const param = parameter('foo', A).optional()

  expect(stringify(param)).toMatchInlineSnapshot(`foo?: A`)
})
