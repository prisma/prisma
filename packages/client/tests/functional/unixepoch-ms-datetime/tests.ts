import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { randomUUID } from 'crypto'

import { AdapterProviders } from '../_utils/providers'
import { DatasourceInfo } from '../_utils/setupTestSuiteEnv'
import { NewPrismaClient } from '../_utils/types'
// @ts-ignore
import testMatrix from './_matrix'
import type * as imports from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<imports.PrismaClient, typeof imports.PrismaClient>

testMatrix.setupTestSuite(
  ({ driverAdapter }, _suiteMeta, _clientMeta, _cliMeta, info) => {
    test('can retrieve a unixepoch-ms date time with a find unique query', async () => {
      const prisma = createClient(info, driverAdapter)

      const created = await prisma.event.create({ data: { name: 'event' } })
      expect(created).toMatchObject({ createdAt: expect.any(Date) })

      const found = await prisma.event.findUnique({
        where: {
          uuid_createdAt: {
            uuid: created.uuid,
            createdAt: created.createdAt,
          },
        },
      })
      expect(found).toMatchObject(created)
    })

    test('can retrieve a unixepoch-ms date time with a find unique query when it was stored directly as a millis number', async () => {
      const prisma = createClient(info, driverAdapter)

      const uuid = randomUUID()
      const now = new Date()
      await prisma.$executeRaw`INSERT INTO Event (name, uuid, createdAt) VALUES ('event', ${uuid}, ${now.getTime()})`

      const found = await prisma.event.findUnique({
        where: {
          uuid_createdAt: {
            uuid,
            createdAt: now,
          },
        },
      })
      expect(found).toMatchObject({ createdAt: now })
    })

    test('can retrieve a unixepoch-ms date time with a raw query', async () => {
      const prisma = createClient(info, driverAdapter)

      const created = await prisma.event.create({ data: { name: 'event' } })
      expect(created).toMatchObject({ createdAt: expect.any(Date) })

      const [event] = (await prisma.$queryRaw`SELECT * FROM Event WHERE createdAt = ${created.createdAt}`) as unknown[]
      expect(event).toMatchObject(created)
    })

    test('can retrieve a unixepoch-ms date time with a raw query by a millis number', async () => {
      const prisma = createClient(info, driverAdapter)

      const created = await prisma.event.create({ data: { name: 'event' } })
      expect(created).toMatchObject({ createdAt: expect.any(Date) })

      const [event] =
        (await prisma.$queryRaw`SELECT * FROM Event WHERE createdAt = ${created.createdAt.getTime()}`) as unknown[]
      expect(event).toMatchObject(created)
    })

    test('can retrieve a unixepoch-ms date time with a find many query', async () => {
      const prisma = createClient(info, driverAdapter)

      const created = await prisma.event.create({ data: { name: 'event' } })
      expect(created).toMatchObject({
        createdAt: expect.any(Date),
      })

      const found = await prisma.event.findMany({
        where: {
          uuid: created.uuid,
          createdAt: created.createdAt,
        },
      })
      expect(found).toEqual([created])
    })

    test('can retrieve a unixepoch-ms date time with compactable find unique queries', async () => {
      const prisma = createClient(info, driverAdapter)

      const created = await prisma.event.create({ data: { name: 'event' } })
      expect(created).toMatchObject({
        createdAt: expect.any(Date),
      })

      const find = () =>
        prisma.event.findUnique({
          where: {
            uuid_createdAt: {
              uuid: created.uuid,
              createdAt: created.createdAt,
            },
          },
        })

      // These two queries are going to be compacted together and run as one.
      await expect(Promise.all([find(), find()])).resolves.toMatchObject([created, created])
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mysql', 'postgresql', 'cockroachdb', 'mongodb'],
      reason: 'testing sqlite-specific timestamp behavior',
    },
    skipDriverAdapter: {
      from: ['js_d1'],
      reason: 'D1 does not need to support the QE unixepoch-ms format',
    },
    skipDefaultClientInstance: true,
    skip: (skip, options) => skip(options.driverAdapter === undefined, 'testing only driver adapters'),
  },
)

function createClient(info: DatasourceInfo, driverAdapter?: `${AdapterProviders}`) {
  const constructor = driverAdapter === AdapterProviders.JS_BETTER_SQLITE3 ? PrismaBetterSqlite3 : PrismaLibSql

  return newPrismaClient({
    // @ts-test-if: driverAdapter !== undefined
    adapter: new constructor(
      {
        url: info.databaseUrl,
      },
      {
        timestampFormat: 'unixepoch-ms',
      },
    ),
  })
}
