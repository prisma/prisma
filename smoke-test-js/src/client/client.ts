import { describe, it } from 'node:test'
import path from 'node:path'
import assert from 'node:assert'
import { PrismaClient } from '@prisma/client'
import type { DriverAdapter } from '@prisma/driver-adapter-utils'
import { getLibQueryEnginePath } from '../libquery/util'

export async function smokeTestClient(driverAdapter: DriverAdapter) {
  const provider = driverAdapter.flavour

  const log = [
    {
      emit: 'event',
      level: 'query',
    } as const,
  ]

  const dirname = path.dirname(new URL(import.meta.url).pathname)
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = getLibQueryEnginePath(dirname)

  // Run twice, once with adapter and once fully without
  for (const adapter of [driverAdapter, null]) {
    const isUsingDriverAdapters = adapter !== null
    describe(isUsingDriverAdapters ? `using Driver Adapters` : `using Rust drivers`, () => {
      it('batch queries', async () => {
        const prisma = new PrismaClient({
          adapter,
          log,
        })

        const queries: string[] = []
        prisma.$on('query', ({ query }) => queries.push(query))

        await prisma.$transaction([
          prisma.$queryRawUnsafe('SELECT 1'),
          prisma.$queryRawUnsafe('SELECT 2'),
          prisma.$queryRawUnsafe('SELECT 3'),
        ])

        const defaultExpectedQueries = [
          'BEGIN',
          'SELECT 1',
          'SELECT 2',
          'SELECT 3',
          'COMMIT',
        ]

        const driverAdapterExpectedQueries = [
          '-- Implicit "BEGIN" query via underlying driver',
          'SELECT 1',
          'SELECT 2',
          'SELECT 3',
          '-- Implicit "COMMIT" query via underlying driver',
        ]

        // TODO: sqlite should be here too but it's too flaky the way the test is currently written,
        // only a subset of logs arrives on time (from 2 to 4 out of 5)
        if (['mysql'].includes(provider)) {
          if (isUsingDriverAdapters) {
            assert.deepEqual(queries, driverAdapterExpectedQueries)
          } else {
            assert.deepEqual(queries, defaultExpectedQueries)
          }
        } else if (['postgres'].includes(provider)) {
          // Note: the "DEALLOCATE ALL" query is only present after "BEGIN" when using Rust Postgres with pgbouncer.
          assert.deepEqual(queries.at(0), defaultExpectedQueries.at(0))
          assert.deepEqual(
            queries.filter((q) => q !== 'DEALLOCATE ALL'),
            defaultExpectedQueries,
          )
        }
      })

      if (provider !== 'sqlite') {
        it('applies isolation level when using batch $transaction', async () => {
          const prisma = new PrismaClient({ adapter, log })

          const queries: string[] = []
          prisma.$on('query', ({ query }) => queries.push(query))

          await prisma.$transaction([prisma.child.findMany(), prisma.child.count()], {
            isolationLevel: 'ReadCommitted',
          })

          if (['mysql'].includes(provider)) {
            assert.deepEqual(queries.slice(0, 2), ['SET TRANSACTION ISOLATION LEVEL READ COMMITTED', 'BEGIN'])
          } else if (['postgres'].includes(provider)) {
            assert.deepEqual(queries.slice(0, 2), ['BEGIN', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'])
          }

          assert.deepEqual(queries.at(-1), 'COMMIT')
        })
      } else {
        describe('isolation levels with sqlite', () => {
          it('accepts Serializable as a no-op', async () => {
            const prisma = new PrismaClient({ adapter, log })

            const queries: string[] = []
            prisma.$on('query', ({ query }) => queries.push(query))

            await prisma.$transaction([prisma.child.findMany(), prisma.child.count()], {
              isolationLevel: 'Serializable',
            })

            if (isUsingDriverAdapters) {
              assert.equal(queries.at(0), '-- Implicit "BEGIN" query via underlying driver')
              assert.equal(queries.at(-1), '-- Implicit "COMMIT" query via underlying driver')
            } else {
              assert.equal(queries.at(0), 'BEGIN')
              assert.equal(queries.at(-1), 'COMMIT')
            }

            assert(!queries.find((q) => q.includes('SET TRANSACTION ISOLATION LEVEL')))
          })

          it('throws on unsupported isolation levels', async () => {
            const prisma = new PrismaClient({ adapter })

            assert.rejects(
              prisma.$transaction([prisma.child.findMany(), prisma.child.count()], {
                isolationLevel: 'ReadCommitted',
              }),
            )
          })

          it('bytes type support', async () => {
            const prisma = new PrismaClient({ adapter, log })

            const result = await prisma.type_test_3.create({
              data: {
                bytes: Buffer.from([1, 2, 3, 4]),
              },
            })

            assert.deepEqual(result.bytes, Buffer.from([1, 2, 3, 4]))
          })
        })
      }
    })
  }
}
