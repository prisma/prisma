import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'
// @ts-ignore trick to get typings at dev time
import type { PrismaClient } from './node_modules/@prisma/client'

const testIf = (condition: boolean) => (condition ? test : test.skip)

if (process.env.CI) {
  // to avoid timeouts on macOS and Windows
  jest.setTimeout(100_000)
} else {
  jest.setTimeout(10_000)
}

let prisma: PrismaClient
const baseUri = process.env.TEST_MYSQL_URI
describe('full-text-search (mysql)', () => {
  beforeAll(async () => {
    process.env.TEST_MYSQL_URI += '-full-text-search'
    await tearDownMysql(process.env.TEST_MYSQL_URI!)
    await migrateDb({
      connectionString: process.env.TEST_MYSQL_URI!,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')

    prisma = new PrismaClient()

    await prisma.user.create({
      data: {
        email: 'email1@email.io',
        name: 'John Smith',
      },
    })

    await prisma.user.create({
      data: {
        email: 'email2@email.io',
        name: 'April ONeal',
      },
    })

    await prisma.user.create({
      data: {
        email: 'email3@email.io',
        name: 'John Pearl',
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_MYSQL_URI = baseUri
  })

  /**
   * Test search with the `+` operator
   */
  test('findMany with +', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '+John +Smith',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: John Smith,
        },
      ]
    `)
  })

  /**
   * Test search with OR
   */
  test('findMany with OR', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: 'John April',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: April ONeal,
        },
        Object {
          email: email1@email.io,
          id: 1,
          name: John Smith,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: John Pearl,
        },
      ]
    `)
  })

  /**
   * Test search with the `-` operators
   */
  test('findMany with -', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: 'John -Smith April',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: April ONeal,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: John Pearl,
        },
      ]
    `)
  })

  /**
   * Get an array of empty results
   */
  test('no results', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '+April +Smith',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`Array []`)
  })

  /**
   * Use an invalid operator
   *
   * TODO: Windows: temporarily skipped because of jestSnapshotSerializer bug.
   */
  testIf(process.platform !== 'win32')('bad operator', async () => {
    const result = prisma.user
      .findMany({
        where: {
          name: {
            search: 'John <-> Smith',
          },
        },
      })
      .catch((error) => {
        // Remove `tsquery.c` line number to make error snapshots portable across PostgreSQL versions.
        error.message = error.message.replace(/line: Some\(\d+\)/, 'line: Some(0)')
        throw error
      })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`.findMany()\` invocation in
            /client/src/__tests__/integration/happy/full-text-search-mysql/test.ts:0:0

              164  */
              165 testIf(process.platform !== 'win32')('bad operator', async () => {
              166   const result = prisma.user
            → 167     .findMany(
              Error occurred during query execution:
            ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Server(ServerError { code: 1064, message: "syntax error, unexpected '-'", state: "42000" })) })
          `)
  })

  test('order by relevance on a single field', async () => {
    const users = await prisma.user.findMany({
      orderBy: {
        _relevance: {
          fields: ['name'],
          search: 'John',
          sort: 'desc',
        },
      },
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: John Smith,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: John Pearl,
        },
        Object {
          email: email2@email.io,
          id: 2,
          name: April ONeal,
        },
      ]
    `)
  })

  test('order by relevance on multiple fields', async () => {
    const users = await prisma.user.findMany({
      orderBy: {
        _relevance: {
          fields: ['name', 'email'],
          search: 'John',
          sort: 'asc',
        },
      },
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: April ONeal,
        },
        Object {
          email: email1@email.io,
          id: 1,
          name: John Smith,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: John Pearl,
        },
      ]
    `)
  })

  test('multiple order by statements on different fields', async () => {
    const users = await prisma.user.findMany({
      orderBy: [
        {
          _relevance: {
            fields: ['name'],
            search: 'John',
            sort: 'desc',
          },
        },
        {
          _relevance: {
            fields: ['email'],
            search: '"email1@email.io"',
            sort: 'asc',
          },
        },
      ],
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email3@email.io,
          id: 3,
          name: John Pearl,
        },
        Object {
          email: email1@email.io,
          id: 1,
          name: John Smith,
        },
        Object {
          email: email2@email.io,
          id: 2,
          name: April ONeal,
        },
      ]
    `)
  })
})
