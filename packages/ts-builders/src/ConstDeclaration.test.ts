import { expect, test } from 'vitest'

import { constDeclaration } from './ConstDeclaration'
import { docComment } from './DocComment'
import { namedType } from './NamedType'
import { stringify } from './stringify'

const A = namedType('A')

test('basic', () => {
  expect(stringify(constDeclaration('B', A))).toMatchInlineSnapshot(`"const B: A"`)
})

test('with doc comment', () => {
  const decl = constDeclaration('B', A).setDocComment(docComment('Some important value'))
  expect(stringify(decl)).toMatchInlineSnapshot(`
    "/**
     * Some important value
     */
    const B: A"
  `)
})
