import { getClientEngineType } from '@prisma/internals'
import path from 'path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'
import { replaceTimeValues } from './__helpers__/replaceTimeValues'

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

  await prisma.$disconnect()

  replaceTimeValues(onInfo)
  replaceTimeValues(onQuery)

  expect(onInfo.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          message: Starting a postgresql pool with XX connections.,
          target: quaint::pooled,
          timestamp: 1970-01-01T00:00:00.000Z,
        },
      ],
    ]
  `)

  expect(onQuery.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          duration: 0,
          params: [0],
          query: SELECT "public"."User"."id" FROM "public"."User" WHERE 1=1 OFFSET $1,
          target: quaint::connector::metrics,
          timestamp: 1970-01-01T00:00:00.000Z,
        },
      ],
    ]
  `)
})

test('interactive transactions logging - library', async () => {
  if (getClientEngineType() !== 'library') {
    return
  }

  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  const onQuery = jest.fn()

  prisma.$on('query', onQuery)

  await prisma.$transaction(async (tx) => {
    await tx.user.findMany()
  })

  await prisma.$disconnect()

  replaceTimeValues(onQuery)

  expect(onQuery.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          duration: 0,
          params: [],
          query: BEGIN,
          target: quaint::connector::metrics,
          timestamp: 1970-01-01T00:00:00.000Z,
        },
      ],
      [
        {
          duration: 0,
          params: [0],
          query: SELECT "public"."User"."id" FROM "public"."User" WHERE 1=1 OFFSET $1,
          target: quaint::connector::metrics,
          timestamp: 1970-01-01T00:00:00.000Z,
        },
      ],
      [
        {
          duration: 0,
          params: [],
          query: COMMIT,
          target: quaint::connector::metrics,
          timestamp: 1970-01-01T00:00:00.000Z,
        },
      ],
    ]
  `)
})
