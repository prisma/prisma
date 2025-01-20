import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ andQuery, orQuery, notQuery, noResultsQuery, badQuery }, _suiteMeta, _clientMeta) => {
    beforeAll(async () => {
      await prisma.user.createMany({
        data: [
          {
            email: 'email1@email.io',
            name: 'John Smith',
          },
          {
            email: 'email2@email.io',
            name: 'April ONeal',
          },
          {
            email: 'email3@email.io',
            name: 'John Pearl',
          },
        ],
      })
    })

    test('AND query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: andQuery,
          },
        },
      })

      expect(result).toEqual([expect.objectContaining({ name: 'John Smith' })])
    })

    test('OR query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: orQuery,
          },
        },
      })

      expect(result).toHaveLength(3)
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Smith' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'April ONeal' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Pearl' }))
    })

    test('NOT query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: notQuery,
          },
        },
      })

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(expect.objectContaining({ name: 'April ONeal' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Pearl' }))
    })

    test('no results', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: noResultsQuery,
          },
        },
      })

      expect(result).toEqual([])
    })

    // TODO: Windows: why is this test skipped?
    // TODO: Edge: skipped because of the error snapshot
    testIf(process.platform !== 'win32')('bad query', async () => {
      const result = prisma.user
        .findMany({
          where: {
            name: {
              search: badQuery,
            },
          },
        })
        .catch((e) => {
          const error = e as Error
          error.message = error.message
            // Remove `tsquery.c` line number to make error snapshots portable across PostgreSQL versions.
            .replace(/line: Some\(\d+\)/, 'line: Some(0)')
            // Align Rust / Driver Adapters divergences: "t1.[column]" -> "`User`.[column]"
            .replace(/t0\./g, '`User`.')
            .replace(' as t0', '')
          throw error
        })

      await expect(result).rejects.toMatchPrismaErrorSnapshot()
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

      expect(users).toEqual([
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
        expect.objectContaining({ name: 'April ONeal' }),
      ])
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

      expect(users).toEqual([
        expect.objectContaining({ name: 'April ONeal' }),
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
      ])
    })

    test('order by relevance: multiple orderBy statements', async () => {
      const users = await prisma.user.findMany({
        orderBy: {
          _relevance: {
            fields: ['name'],
            search: 'John',
            sort: 'desc',
          },
        },
      })

      expect(users).toEqual([
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
        expect.objectContaining({ name: 'April ONeal' }),
      ])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'these connectors do not support full-text search',
    },
  },
)
