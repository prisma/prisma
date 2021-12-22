import { getClientEngineType } from '@prisma/sdk'
import path from 'path'
import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeEach(async () => {
  process.env.TEST_POSTGRES_URI += '-logging-library'
  await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('basic event logging - library', async () => {
  if (getClientEngineType() !== 'library') {
    return
  }

  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  const onInfo = jest.fn()
  const onQuery = jest.fn()

  prisma.$on('info', onInfo)
  prisma.$on('query', onQuery)

  await prisma.user.findMany()

  prisma.$disconnect()

  if (typeof onQuery.mock.calls[0][0].duration === 'number') {
    onQuery.mock.calls[0][0].duration = 0
  }

  expect(onInfo.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          message: Starting a postgresql pool with 17 connections.,
          target: undefined,
          timestamp: undefined,
        },
      ],
    ]
  `)

  expect(onQuery.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          duration: 2,
          params: [0],
          query: SELECT "public"."User"."id" FROM "public"."User" WHERE 1=1 OFFSET $1,
          target: quaint::connector::metrics,
          timestamp: 1640187303896,
        },
      ],
    ]
  `)
})
