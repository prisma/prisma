import { DataSource } from '@prisma/generator-helper'
import { datasourceToDatasourceOverwrite, serializeDatasources } from '../generation/serializeDatasources'
import { absolutizeRelativePath, resolveDatasources } from '../utils/resolveDatasources'

const cwd = '/Users/tim/project/prisma'
const outputDir = '/Users/tim/project/node_modules/@generated/photon/runtime'

test('absolutizeRelativePath', () => {
  expect(absolutizeRelativePath('file:db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/db.db')"`,
  )
  expect(absolutizeRelativePath('file:/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../../../../db.db')"`,
  )
  expect(absolutizeRelativePath('file:../db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../db.db')"`,
  )
  expect(absolutizeRelativePath('file:./db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/db.db')"`,
  )

  expect(absolutizeRelativePath('file:asd/another/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/asd/another/dir/db.db')"`,
  )
  expect(absolutizeRelativePath('file:/some/random/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../../../../some/random/dir/db.db')"`,
  )
  expect(
    absolutizeRelativePath('file:/Users/tim/project/node_modules/@generated/photon/runtime', cwd, outputDir),
  ).toMatchInlineSnapshot(`"'file:' + path.resolve(__dirname, '')"`)
  expect(absolutizeRelativePath('file:../another-dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../another-dir/db.db')"`,
  )
  expect(absolutizeRelativePath('file:./some/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/some/dir/db.db')"`,
  )
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
  expect(resolveDatasources(datasources, cwd, outputDir)).toMatchInlineSnapshot(`
    Array [
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db",
        "url": Object {
          "fromEnvVar": null,
          "value": "'file:' + path.resolve(__dirname, '../../../../prisma/db.db')",
        },
      },
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db2",
        "url": Object {
          "fromEnvVar": null,
          "value": "'file:' + path.resolve(__dirname, '../../../../prisma/some-dir/db.db')",
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
  expect(serializeDatasources(resolveDatasources(datasources, cwd, outputDir).map(datasourceToDatasourceOverwrite)))
    .toMatchInlineSnapshot(`
    "[
      {
        \\"name\\": \\"db\\",
        \\"url\\": 'file:' + path.resolve(__dirname, '../../../../prisma/db.db')
      },
      {
        \\"name\\": \\"db2\\",
        \\"url\\": 'file:' + path.resolve(__dirname, '../../../../prisma/some-dir/db.db')
      },
      {
        \\"name\\": \\"db3\\",
        \\"url\\": \\"mysql:localhost\\"
      }
    ]"
  `)
})
