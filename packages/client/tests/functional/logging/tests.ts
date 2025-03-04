import { faker } from '@faker-js/faker'

import { Providers } from '../_utils/providers'
import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(({ provider, driverAdapter }) => {
  const isMongoDb = provider === Providers.MONGODB
  const isSqlServer = provider === Providers.SQLSERVER

  let client: PrismaClient<Prisma.PrismaClientOptions, 'query'>

  test('should log queries on a method call', async () => {
    client = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    const queryLogPromise = new Promise<Prisma.QueryEvent>((resolve) => {
      client.$on('query', (data) => {
        if ('query' in data) {
          resolve(data)
        }
      })
    })

    await client.user.findMany()

    const queryLogEvents = await queryLogPromise
    expect(queryLogEvents).toHaveProperty('query')
    expect(queryLogEvents).toHaveProperty('duration')
    expect(queryLogEvents).toHaveProperty('timestamp')
    expect(queryLogEvents).toHaveProperty('params')
    expect(queryLogEvents).toHaveProperty('target')

    if (isMongoDb) {
      expect(queryLogEvents.query).toContain('db.User.aggregate')
    } else {
      expect(queryLogEvents.query).toContain('SELECT')
    }
  })

  // D1: iTx are not available.
  skipTestIf(driverAdapter === 'js_d1')('should log queries inside a ITX', async () => {
    client = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    const queryLogs = new Promise<Prisma.QueryEvent[]>((resolve) => {
      const logs: Prisma.QueryEvent[] = []

      client.$on('query', (data) => {
        if ('query' in data) {
          logs.push(data)

          if (isMongoDb && logs.length === 3) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    await client.$transaction(async (tx) => {
      const id = isMongoDb ? faker.database.mongodbObjectId() : faker.string.numeric()

      await tx.user.create({
        data: {
          id,
        },
      })

      return tx.user.findMany({
        where: {
          id,
        },
      })
    })

    const logs = await queryLogs

    if (isMongoDb) {
      expect(logs).toHaveLength(3)

      expect(logs[0].query).toContain('User.insertOne')
      expect(logs[1].query).toContain('User.aggregate')
      expect(logs[2].query).toContain('User.aggregate')
    } else {
      // - Since https://github.com/prisma/prisma-engines/pull/4041,
      //   we skip a read when possible, on CockroachDB and PostgreSQL.
      // - Since https://github.com/prisma/prisma-engines/pull/4640,
      //   we also skip a read when possible, on SQLite.
      if (['postgresql', 'cockroachdb', 'sqlite'].includes(provider)) {
        expect(logs).toHaveLength(4)
        expect(logs[0].query).toContain('BEGIN')
        expect(logs[1].query).toContain('INSERT')
        expect(logs[2].query).toContain('SELECT')
        expect(logs[3].query).toContain('COMMIT')
      } else {
        expect(logs).toHaveLength(isSqlServer ? 6 : 5)
        if (isSqlServer) {
          expect(logs.shift()?.query).toContain('SET TRANSACTION')
        }
        expect(logs.shift()?.query).toContain('BEGIN')
        expect(logs.shift()?.query).toContain('INSERT')
        expect(logs.shift()?.query).toContain('SELECT')
        expect(logs.shift()?.query).toContain('SELECT')
        expect(logs.shift()?.query).toContain('COMMIT')
      }
    }
  })

  // D1: iTx are not available.
  skipTestIf(driverAdapter === 'js_d1')('should log batched queries inside a ITX', async () => {
    client = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    const queryLogs = new Promise<Prisma.QueryEvent[]>((resolve) => {
      const logs: Prisma.QueryEvent[] = []

      client.$on('query', (data) => {
        if ('query' in data) {
          logs.push(data)

          if (isMongoDb && logs.length === 2) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    await client.$transaction(async (tx) => {
      const id = isMongoDb ? faker.database.mongodbObjectId() : faker.string.numeric()

      await Promise.all([
        tx.user.findMany({
          where: {
            id,
          },
        }),
        tx.user.findMany({
          where: {
            id,
          },
        }),
      ])
    })

    const logs = await queryLogs

    if (isMongoDb) {
      expect(logs).toHaveLength(2)

      expect(logs[0].query).toContain('User.aggregate')
      expect(logs[0].query).toContain('User.aggregate')
    } else {
      expect(logs).toHaveLength(isSqlServer ? 5 : 4)
      if (isSqlServer) {
        expect(logs.shift()?.query).toContain('SET TRANSACTION')
      }
      expect(logs.shift()?.query).toContain('BEGIN')
      expect(logs.shift()?.query).toContain('SELECT')
      expect(logs.shift()?.query).toContain('SELECT')
      expect(logs.shift()?.query).toContain('COMMIT')
    }
  })

  test('should log transaction batched queries', async () => {
    client = newPrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })

    const queryLogs = new Promise<Prisma.QueryEvent[]>((resolve) => {
      const logs: Prisma.QueryEvent[] = []

      client.$on('query', (data) => {
        if ('query' in data) {
          logs.push(data)

          if (isMongoDb && logs.length === 2) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    const id = isMongoDb ? faker.database.mongodbObjectId() : faker.string.numeric()

    const q1 = client.user.findMany({
      where: {
        id,
      },
    })

    const q2 = client.user.findMany({
      where: {
        id,
      },
    })

    await client.$transaction([q1, q2])

    const logs = await queryLogs

    if (isMongoDb) {
      expect(logs).toHaveLength(2)

      expect(logs[0].query).toContain('User.aggregate')
      expect(logs[0].query).toContain('User.aggregate')
    } else {
      expect(logs).toHaveLength(isSqlServer ? 5 : 4)
      if (isSqlServer) {
        expect(logs.shift()?.query).toContain('SET TRANSACTION')
      }
      expect(logs.shift()?.query).toContain('BEGIN')
      expect(logs.shift()?.query).toContain('SELECT')
      expect(logs.shift()?.query).toContain('SELECT')
      expect(logs.shift()?.query).toContain('COMMIT')
    }
  })
})
