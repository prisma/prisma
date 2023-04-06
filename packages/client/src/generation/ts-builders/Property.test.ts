import { docComment } from './DocComment'
import { namedType } from './NamedType'
import { property } from './Property'
import { stringify } from './stringify'

const A = namedType('A')

test('name and type', () => {
  const prop = property('foo', A)

  expect(stringify(prop)).toMatchInlineSnapshot(`foo: A`)
})

test('optional', () => {
  const prop = property('foo', A).optional()

  expect(stringify(prop)).toMatchInlineSnapshot(`foo?: A | undefined`)
})

test('readonly', () => {
  const prop = property('foo', A).readonly()

  expect(stringify(prop)).toMatchInlineSnapshot(`readonly foo: A`)
})

test('with doc comment', () => {
  const prop = property('foo', A).setDocComment(docComment('This is foo'))

  expect(stringify(prop)).toMatchInlineSnapshot(`
    /**
     * This is foo
     */
    foo: A
  `)
})
