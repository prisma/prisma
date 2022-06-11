import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
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
const baseUri = process.env.TEST_POSTGRES_URI
describe('full-text-search (postgres)', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-full-text-search'
    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    await migrateDb({
      connectionString: process.env.TEST_POSTGRES_URI!,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')

    prisma = new PrismaClient()

    await prisma.user.create({
      data: {
        email: 'email1@email.io',
        name: '0 1 2 3 4 5 6 7 8',
      },
    })

    await prisma.user.create({
      data: {
        email: 'email2@email.io',
        name: '0 2 4 6 8',
      },
    })

    await prisma.user.create({
      data: {
        email: 'email3@email.io',
        name: '1 3 5 7 9',
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_POSTGRES_URI = baseUri
  })

  /**
   * Test search with the `&` operator
   */
  test('findMany with &', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '1 & 2',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
      ]
    `)
  })

  /**
   * Test search with the `|` operator
   */
  test('findMany with |', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '1 | 2',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: 1 3 5 7 9,
        },
      ]
    `)
  })

  /**
   * Test search with the `<->` operator
   */
  test('findMany with <->', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '4 <-> 5',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
      ]
    `)
  })

  /**
   * Test search with the `|` + `&` operators
   */
  test('findMany with & and |', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '(0 | 1) & (2 | 3)',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: 1 3 5 7 9,
        },
      ]
    `)
  })

  /**
   * Test search with the `!` operator
   */
  test('findMany with !', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: {
          search: '0 & !1',
        },
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
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
          search: '!0 & !1',
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
            search: '0 1',
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
            /client/src/__tests__/integration/happy/full-text-search-postgres/test.ts:0:0

              215  */
              216 testIf(process.platform !== 'win32')('bad operator', async () => {
              217   const result = prisma.user
            → 218     .findMany(
              Error occurred during query execution:
            ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Error { kind: Db, cause: Some(DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42601), message: "syntax error in tsquery: \\"0 1\\"", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tsquery.c"), line: Some(0), routine: Some("makepol") }) }) })
          `)
  })

  test('order by relevance on a single field', async () => {
    const users = await prisma.user.findMany({
      orderBy: {
        _relevance: {
          fields: ['name'],
          search: '1 & 2 & 3',
          sort: 'desc',
        },
      },
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: 1 3 5 7 9,
        },
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
        },
      ]
    `)
  })

  test('order by relevance on multiple fields', async () => {
    const users = await prisma.user.findMany({
      orderBy: {
        _relevance: {
          fields: ['name', 'email'],
          search: '3',
          sort: 'asc',
        },
      },
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
        },
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: 1 3 5 7 9,
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
            search: '0',
            sort: 'desc',
          },
        },
        {
          _relevance: {
            fields: ['email'],
            search: 'email1@email.io',
            sort: 'asc',
          },
        },
      ],
    })

    expect(users).toMatchInlineSnapshot(`
      Array [
        Object {
          email: email2@email.io,
          id: 2,
          name: 0 2 4 6 8,
        },
        Object {
          email: email1@email.io,
          id: 1,
          name: 0 1 2 3 4 5 6 7 8,
        },
        Object {
          email: email3@email.io,
          id: 3,
          name: 1 3 5 7 9,
        },
      ]
    `)
  })
})
