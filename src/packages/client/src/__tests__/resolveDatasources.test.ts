import { DataSource } from '@prisma/generator-helper'
import {
  datasourceToDatasourceOverwrite,
  serializeDatasources,
} from '../generation/serializeDatasources'
import {
  absolutizeRelativePath,
  resolveDatasources,
} from '../utils/resolveDatasources'

const cwd = '/Users/tim/project/prisma'
const outputDir = '/Users/tim/project/node_modules/@prisma/client/runtime'

test('absolutizeRelativePath', () => {
  expect(
    absolutizeRelativePath('file:db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../prisma/db.db"`)
  expect(
    absolutizeRelativePath('file:/db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../../../../db.db"`)
  expect(
    absolutizeRelativePath('file:../db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../db.db"`)
  expect(
    absolutizeRelativePath('file:./db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../prisma/db.db"`)

  expect(
    absolutizeRelativePath('file:asd/another/dir/db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../prisma/asd/another/dir/db.db"`)
  expect(
    absolutizeRelativePath('file:/some/random/dir/db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../../../../some/random/dir/db.db"`)
  expect(
    absolutizeRelativePath(
      'file:/Users/tim/project/node_modules/@prisma/client/runtime',
      cwd,
      outputDir,
    ),
  ).toMatchInlineSnapshot(`""`)
  expect(
    absolutizeRelativePath('file:../another-dir/db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../another-dir/db.db"`)
  expect(
    absolutizeRelativePath('file:./some/dir/db.db', cwd, outputDir),
  ).toMatchInlineSnapshot(`"../../../../prisma/some/dir/db.db"`)
})

const datasources: DataSource[] = [
  {
    name: 'db',
    url: {
      value: 'file:db.db',
      fromEnvVar: null,
    },
    connectorType: 'sqlite',
    config: {},
  },
  {
    name: 'db2',
    url: {
      value: 'file:./some-dir/db.db',
      fromEnvVar: null,
    },
    connectorType: 'sqlite',
    config: {},
  },
  {
    name: 'db3',
    url: {
      value: 'mysql:localhost',
      fromEnvVar: null,
    },
    connectorType: 'mysql',
    config: {},
  },
]

test('resolveDatasources', () => {
  expect(resolveDatasources(datasources, cwd, outputDir))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db",
        "url": Object {
          "fromEnvVar": null,
          "value": "../../../../prisma/db.db",
        },
      },
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db2",
        "url": Object {
          "fromEnvVar": null,
          "value": "../../../../prisma/some-dir/db.db",
        },
      },
      Object {
        "config": Object {},
        "connectorType": "mysql",
        "name": "db3",
        "url": Object {
          "fromEnvVar": null,
          "value": "mysql:localhost",
        },
      },
    ]
  `)
})

test('serializeDatasources', () => {
  expect(
    serializeDatasources(
      resolveDatasources(datasources, cwd, outputDir).map(
        datasourceToDatasourceOverwrite,
      ),
    ),
  ).toMatchInlineSnapshot(`
    "[
      {
        \\"name\\": \\"db\\",
        \\"url\\": \\"../../../../prisma/db.db\\"
      },
      {
        \\"name\\": \\"db2\\",
        \\"url\\": \\"../../../../prisma/some-dir/db.db\\"
      },
      {
        \\"name\\": \\"db3\\",
        \\"url\\": \\"mysql:localhost\\"
      }
    ]"
  `)
})
