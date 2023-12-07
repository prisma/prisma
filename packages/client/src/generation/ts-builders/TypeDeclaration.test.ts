import { docComment } from './DocComment'
import { genericParameter } from './GenericParameter'
import { namedType } from './NamedType'
import { stringify } from './stringify'
import { typeDeclaration } from './TypeDeclaration'

const A = namedType('A')

test('basic', () => {
  expect(stringify(typeDeclaration('B', A))).toMatchInlineSnapshot(`type B = A`)
})

test('with doc comment', () => {
  const decl = typeDeclaration('B', A).setDocComment(docComment('Type for stuff'))
  expect(stringify(decl)).toMatchInlineSnapshot(`
    /**
     * Type for stuff
     */
    type B = A
  `)
})

test('with generic parameters', () => {
  const decl = typeDeclaration('B', A).addGenericParameter(genericParameter('T'))
  expect(stringify(decl)).toMatchInlineSnapshot(`type B<T> = A`)
})

test('with multiple generic parameters', () => {
  const decl = typeDeclaration('B', A)
    .addGenericParameter(genericParameter('T'))
    .addGenericParameter(genericParameter('U'))
  expect(stringify(decl)).toMatchInlineSnapshot(`type B<T, U> = A`)
})
