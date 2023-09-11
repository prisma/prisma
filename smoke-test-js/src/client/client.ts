import { describe, it } from 'node:test'
import assert from 'node:assert'
import { PrismaClient } from '@prisma/client'
import type { DriverAdapter } from '@jkomyno/prisma-driver-adapter-utils'

export async function smokeTestClient(driverAdapter: DriverAdapter) {
  const provider = driverAdapter.flavour

  const log = [
    {
      emit: 'event',
      level: 'query',
    } as const,
  ]

  for (const adapter of [driverAdapter, undefined]) {
    const isUsingDriverAdapters = adapter !== undefined
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
            defaultExpectedQueries
          )
        }
      })
    
      it('applies isolation level when using batch $transaction', async () => {
        const prisma = new PrismaClient({
          adapter,
          log,
        })
    
        const queries: string[] = []
        prisma.$on('query', ({ query }) => queries.push(query))
    
        await prisma.$transaction([
          prisma.child.findMany(),
          prisma.child.count(),
        ], {
          isolationLevel: 'ReadCommitted',
        })
    
        if (['mysql'].includes(provider)) {
          assert.deepEqual(queries.slice(0, 2), [
            'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
            'BEGIN',
          ])
        } else if (['postgres'].includes(provider)) {
          assert.deepEqual(queries.slice(0, 2), [
            'BEGIN',
            'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
          ])
        }
    
        assert.deepEqual(queries.at(-1), 'COMMIT')
      })
    })
  }
}
