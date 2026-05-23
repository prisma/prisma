import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('timetz[] raw query does not throw P2010 (OID 1270 mapping)', async () => {
      const result = await prisma.$queryRaw<{ times: string[] }[]>`
        SELECT ARRAY['12:00:00+00'::timetz, '13:00:00-05'::timetz] AS times
      `
      // Values are returned as strings with the timezone offset stripped,
      // consistent with scalar timetz behaviour.
      expect(result[0].times).toEqual(['12:00:00', '13:00:00'])
    })

    test('timetz[] NULL value returns null', async () => {
      const result = await prisma.$queryRaw<{ v: string[] | null }[]>`
        SELECT NULL::timetz[] AS v
      `
      expect(result[0].v).toBeNull()
    })

    test('timetz[] single-element array is returned as an array', async () => {
      const result = await prisma.$queryRaw<{ times: string[] }[]>`
        SELECT ARRAY['08:30:00+05:30'::timetz] AS times
      `
      expect(result[0].times).toEqual(['08:30:00'])
    })

    test('timetz[] model column round-trips via raw SQL', async () => {
      await prisma.$executeRaw`INSERT INTO "A" ("times") VALUES (ARRAY['12:00:00+00'::timetz, '08:30:00+05:30'::timetz])`
      const result = await prisma.$queryRaw<{ times: string[] }[]>`
        SELECT "times" FROM "A" WHERE "times" IS NOT NULL LIMIT 1
      `
      expect(result[0].times).toEqual(['12:00:00', '08:30:00'])
    })
  },
  {
    optOut: {
      from: [
        Providers.COCKROACHDB,
        Providers.SQLSERVER,
        Providers.MONGODB,
        Providers.SQLITE,
        Providers.MYSQL,
        Providers.MARIADB,
      ],
      reason: 'timetz[] is a PostgreSQL-only type',
    },
    skipDriverAdapter: {
      from: ['js_neon'],
      reason: 'testing OID 1270 (timetz[]) type mapping in the js_pg adapter',
    },
  },
)
