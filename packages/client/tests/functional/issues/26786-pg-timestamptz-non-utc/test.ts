import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// Regression test for:
//   https://github.com/prisma/prisma/issues/26786 (read: offset swapped instead of UTC-converted)
//   https://github.com/prisma/prisma/issues/28629 (write: no UTC marker on stored value)
testMatrix.setupTestSuite(
  () => {
    // A fixed UTC instant used throughout this suite.
    const UTC_ISO = '2025-11-24T15:26:34.887Z'
    const utcDate = new Date(UTC_ISO)

    beforeEach(async () => {
      // Force the session to a non-UTC timezone so both bugs manifest:
      //   - write bug: without '+00:00' the DB would store local time, not UTC
      //   - read bug:  without proper conversion the returned string would shift by the offset
      await prisma.$executeRawUnsafe(`SET timezone = 'America/New_York'`)
    })

    test('round-trips a @db.Timestamptz value correctly with a non-UTC session', async () => {
      const created = await prisma.event.create({ data: { happenedAt: utcDate } })

      expect(created.happenedAt).toBeInstanceOf(Date)
      expect(created.happenedAt.toISOString()).toBe(UTC_ISO)
    })

    test('reads back the correct UTC instant via findFirst', async () => {
      await prisma.event.create({ data: { happenedAt: utcDate } })
      const found = await prisma.event.findFirst({ orderBy: { id: 'desc' } })

      expect(found?.happenedAt.toISOString()).toBe(UTC_ISO)
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'TIMESTAMPTZ and SET timezone are PostgreSQL-specific',
    },
  },
)
