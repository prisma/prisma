import { moduleImport, namedImport } from './Import'
import { stringify } from './stringify'

test('module name only', () => {
  expect(stringify(moduleImport('someModule'))).toMatchInlineSnapshot(`"import "someModule""`)
})

test('default', () => {
  const importDecl = moduleImport('myModule').default('mod')
  expect(stringify(importDecl)).toMatchInlineSnapshot(`"import mod from "myModule""`)
})

test('namespace', () => {
  const importDecl = moduleImport('myModule').asNamespace('ns')
  expect(stringify(importDecl)).toMatchInlineSnapshot(`"import * as ns from "myModule""`)
})

test('named', () => {
  const importDecl = moduleImport('myModule').named('func')
  expect(stringify(importDecl)).toMatchInlineSnapshot(`"import { func } from "myModule""`)
})

test('named with alias', () => {
  const importDecl = moduleImport('myModule').named(namedImport('func').as('myFunc'))
  expect(stringify(importDecl)).toMatchInlineSnapshot(`"import { func as myFunc } from "myModule""`)
})

test('multiple named', () => {
  const importDecl = moduleImport('myModule')
    .named('func1')
    .named('func2')
    .named(namedImport('func3').as('aliasedFunc3'))
  expect(stringify(importDecl)).toMatchInlineSnapshot(
    `"import { func1, func2, func3 as aliasedFunc3 } from "myModule""`,
  )
})

test('default and named', () => {
  const importDecl = moduleImport('myModule').default('mod').named('func1').named('func2')
  expect(stringify(importDecl)).toMatchInlineSnapshot(`"import mod, { func1, func2 } from "myModule""`)
})
