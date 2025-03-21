import path from 'node:path'

import { expect, test } from 'vitest'

import { absolutizeRelativePath } from './resolveDatasources'

const cwd = '/Users/tim/project/prisma'
const outputDir = '/Users/tim/project/node_modules/@prisma/client/runtime'

expect.addSnapshotSerializer({
  test: (val) => path.sep === '\\' && typeof val === 'string' && val.includes('\\'),
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = val.replaceAll('\\', '/')
    return printer(newVal, config, indentation, depth, refs)
  },
})

test('absolutizeRelativePath', () => {
  expect(absolutizeRelativePath('file:db.db', cwd, outputDir)).toMatchInlineSnapshot(`"../../../../prisma/db.db"`)
  expect(absolutizeRelativePath('file:/db.db', cwd, outputDir)).toMatchInlineSnapshot(`"../../../../../../../db.db"`)
  expect(absolutizeRelativePath('file:../db.db', cwd, outputDir)).toMatchInlineSnapshot(`"../../../../db.db"`)
  expect(absolutizeRelativePath('file:./db.db', cwd, outputDir)).toMatchInlineSnapshot(`"../../../../prisma/db.db"`)

  expect(absolutizeRelativePath('file:asd/another/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"../../../../prisma/asd/another/dir/db.db"`,
  )
  expect(absolutizeRelativePath('file:/some/random/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"../../../../../../../some/random/dir/db.db"`,
  )
  expect(
    absolutizeRelativePath('file:/Users/tim/project/node_modules/@prisma/client/runtime', cwd, outputDir),
  ).toMatchInlineSnapshot(`""`)
  expect(absolutizeRelativePath('file:../another-dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"../../../../another-dir/db.db"`,
  )
  expect(absolutizeRelativePath('file:./some/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"../../../../prisma/some/dir/db.db"`,
  )
})
