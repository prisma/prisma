import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
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
  },
  {
    ...defaultTestSuiteOptions,
    skipDriverAdapter: {
      from: ['js_neon'],
      reason: 'testing OID 1270 (timetz[]) type mapping in the js_pg adapter',
    },
  },
)
