import { moduleExportFrom, namedExport } from './ExportFrom'
import { stringify } from './stringify'

test('module name only', () => {
  expect(stringify(moduleExportFrom('someModule'))).toMatchInlineSnapshot(`"export * from "someModule""`)
})

test('namespace', () => {
  const exportDecl = moduleExportFrom('myModule').asNamespace('ns')
  expect(stringify(exportDecl)).toMatchInlineSnapshot(`"export * as ns from 'myModule'"`)
})

test('named', () => {
  const exportDecl = moduleExportFrom('myModule').named('func')
  expect(stringify(exportDecl)).toMatchInlineSnapshot(`"export { func } from "myModule""`)
})

test('named with alias', () => {
  const exportDecl = moduleExportFrom('myModule').named(namedExport('func').as('myFunc'))
  expect(stringify(exportDecl)).toMatchInlineSnapshot(`"export { func as myFunc } from "myModule""`)
})

test('multiple named', () => {
  const exportDecl = moduleExportFrom('myModule')
    .named('func1')
    .named('func2')
    .named(namedExport('func3').as('aliasedFunc3'))
  expect(stringify(exportDecl)).toMatchInlineSnapshot(
    `"export { func1, func2, func3 as aliasedFunc3 } from "myModule""`,
  )
})
