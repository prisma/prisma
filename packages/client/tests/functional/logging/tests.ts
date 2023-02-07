import { faker } from '@faker-js/faker'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig, _suiteMeta, clientMeta) => {
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

    if (suiteConfig.provider === 'mongodb') {
      expect(queryLogEvents.query).toContain('db.User.aggregate')
    } else {
      expect(queryLogEvents.query).toContain('SELECT')
    }
  })

  test('should log queries inside a ITX', async () => {
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

          if (suiteConfig.provider === 'mongodb' && logs.length === 3) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    await client.$transaction(async (tx) => {
      const id = suiteConfig.provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.numeric()

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

    if (suiteConfig.provider === 'mongodb') {
      expect(logs).toHaveLength(3)

      expect(logs[0].query).toContain('User.insertOne')
      expect(logs[1].query).toContain('User.aggregate')
      expect(logs[2].query).toContain('User.aggregate')
    } else {
      expect(logs).toHaveLength(5)

      expect(logs[0].query).toContain('BEGIN')
      expect(logs[1].query).toContain('INSERT')
      expect(logs[2].query).toContain('SELECT')
      expect(logs[3].query).toContain('SELECT')
      expect(logs[4].query).toContain('COMMIT')
    }
  })

  test('should log batched queries inside a ITX', async () => {
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

          if (suiteConfig.provider === 'mongodb' && logs.length === 2) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    await client.$transaction(async (tx) => {
      const id = suiteConfig.provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.numeric()

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

    if (suiteConfig.provider === 'mongodb') {
      expect(logs).toHaveLength(2)

      expect(logs[0].query).toContain('User.aggregate')
      expect(logs[0].query).toContain('User.aggregate')
    } else {
      expect(logs).toHaveLength(4)

      expect(logs[0].query).toContain('BEGIN')
      expect(logs[1].query).toContain('SELECT')
      expect(logs[2].query).toContain('SELECT')
      expect(logs[3].query).toContain('COMMIT')
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

          if (suiteConfig.provider === 'mongodb' && logs.length === 2) {
            resolve(logs)
          }

          if ((data.query as string).includes('COMMIT')) {
            resolve(logs)
          }
        }
      })
    })

    const id = suiteConfig.provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.numeric()

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

    if (suiteConfig.provider === 'mongodb') {
      expect(logs).toHaveLength(2)

      expect(logs[0].query).toContain('User.aggregate')
      expect(logs[0].query).toContain('User.aggregate')
    } else {
      expect(logs).toHaveLength(4)

      expect(logs[0].query).toContain('BEGIN')
      expect(logs[1].query).toContain('SELECT')
      expect(logs[2].query).toContain('SELECT')
      expect(logs[3].query).toContain('COMMIT')
    }
  })
})
