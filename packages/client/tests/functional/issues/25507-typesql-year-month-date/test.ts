import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import * as Sql from './generated/prisma/sql'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let sql: typeof Sql

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          name: 'John Doe',
          createdAt: new Date('2025-07-30T00:01:02.000Z'),
        },
      })
    })
    test('test issue 25507 count by day', async () => {
      const expectedDay = BigInt(30)
      const countByDayResult = await prisma.$queryRawTyped(sql.countUserByDay())

      expect(countByDayResult[0].day).toBe(expectedDay)
      expectTypeOf(countByDayResult[0].day).toEqualTypeOf<bigint>()
    })
    test('test issue 25507 count by month', async () => {
      const expectedMonth = BigInt(7)
      const countByMonthResult = await prisma.$queryRawTyped(sql.countUserByMonth())

      expect(countByMonthResult[0].month).toBe(expectedMonth)
      expectTypeOf(countByMonthResult[0].month).toEqualTypeOf<bigint>()
    })
    test('test issue 25507 count by year', async () => {
      const expectedYear = 2025
      const countByYearResult = await prisma.$queryRawTyped(sql.countUserByYear())

      expect(countByYearResult[0].year).toBe(expectedYear)
      expectTypeOf(countByYearResult[0].year).toBeNumber()
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlserver', 'cockroachdb', 'postgresql', 'sqlite'],
      reason: 'SQL dialect differs per database, focusing on MySql in this test',
    },
  },
)
