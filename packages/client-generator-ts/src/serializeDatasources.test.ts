import path from 'node:path'

import { DataSource } from '@prisma/generator'
import { expect, test } from 'vitest'

import { datasourceToDatasourceOverwrite, serializeDatasources } from './serializeDatasources'

const sourceFilePath = path.join(process.cwd(), 'prisma', 'schema.prisma')

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
    sourceFilePath,
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
    sourceFilePath,
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
    sourceFilePath,
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
    sourceFilePath,
  },
]

test('serializeDatasources', () => {
  expect(serializeDatasources(datasources.map(datasourceToDatasourceOverwrite))).toMatchInlineSnapshot(`
    "[
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
    ]"
  `)
})
