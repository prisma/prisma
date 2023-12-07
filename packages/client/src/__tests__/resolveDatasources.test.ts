import type { DataSource } from '@prisma/generator-helper'

import { datasourceToDatasourceOverwrite, serializeDatasources } from '../generation/serializeDatasources'
import { absolutizeRelativePath } from '../utils/resolveDatasources'

const cwd = '/Users/tim/project/prisma'
const outputDir = '/Users/tim/project/node_modules/@prisma/client/runtime'

test('absolutizeRelativePath', () => {
  expect(absolutizeRelativePath('file:db.db', cwd, outputDir)).toMatchInlineSnapshot(`../../../../prisma/db.db`)
  expect(absolutizeRelativePath('file:/db.db', cwd, outputDir)).toMatchInlineSnapshot(`../../../../../../../db.db`)
  expect(absolutizeRelativePath('file:../db.db', cwd, outputDir)).toMatchInlineSnapshot(`../../../../db.db`)
  expect(absolutizeRelativePath('file:./db.db', cwd, outputDir)).toMatchInlineSnapshot(`../../../../prisma/db.db`)

  expect(absolutizeRelativePath('file:asd/another/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `../../../../prisma/asd/another/dir/db.db`,
  )
  expect(absolutizeRelativePath('file:/some/random/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `../../../../../../../some/random/dir/db.db`,
  )
  expect(
    absolutizeRelativePath('file:/Users/tim/project/node_modules/@prisma/client/runtime', cwd, outputDir),
  ).toMatchInlineSnapshot(``)
  expect(absolutizeRelativePath('file:../another-dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `../../../../another-dir/db.db`,
  )
  expect(absolutizeRelativePath('file:./some/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `../../../../prisma/some/dir/db.db`,
  )
})

const datasources: DataSource[] = [
  {
    name: 'db',
    url: {
      value: 'file:db.db',
      fromEnvVar: null,
    },
    activeProvider: 'sqlite',
    provider: 'sqlite',
    schemas: [],
  },
  {
    name: 'db2',
    url: {
      value: 'file:./some-dir/db.db',
      fromEnvVar: null,
    },
    activeProvider: 'sqlite',
    provider: 'sqlite',
    schemas: [],
  },
  {
    name: 'db3',
    url: {
      value: 'mysql:localhost',
      fromEnvVar: null,
    },
    activeProvider: 'mysql',
    provider: 'mysql',
    schemas: [],
  },
  {
    name: 'db4',
    url: {
      value: 'postgresql://',
      fromEnvVar: null,
    },
    activeProvider: 'postgresql',
    provider: 'postgresql',
    schemas: [],
  },
]

test('serializeDatasources', () => {
  expect(serializeDatasources(datasources.map(datasourceToDatasourceOverwrite))).toMatchInlineSnapshot(`
    [
      {
        "name": "db",
        "url": "file:db.db"
      },
      {
        "name": "db2",
        "url": "file:./some-dir/db.db"
      },
      {
        "name": "db3",
        "url": "mysql:localhost"
      },
      {
        "name": "db4",
        "url": "postgresql://"
      }
    ]
  `)
})
