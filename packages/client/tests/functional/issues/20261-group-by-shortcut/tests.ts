import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.round.create({ data: { teamName: 'Red', points: 5 } })
    await prisma.round.create({ data: { teamName: 'Blue', points: 7 } })
    await prisma.round.create({ data: { teamName: 'Red', points: 4 } })
    await prisma.round.create({ data: { teamName: 'Blue', points: 3 } })
  })

  test('works with a scalar in "by"', async () => {
    const result = await prisma.round.groupBy({
      _sum: {
        points: true,
      },
      by: 'teamName',
      orderBy: { teamName: 'asc' },
    })

    expect(result).toEqual([
      {
        _sum: {
          points: 10,
        },
        teamName: 'Blue',
      },
      {
        _sum: {
          points: 9,
        },
        teamName: 'Red',
      },
    ])

    expectTypeOf(result).toMatchTypeOf<
      Array<{
        _sum: {
          points: number | null
        }
        teamName: string
      }>
    >()
  })

  test('works with a scalar in "by" and no other selection', async () => {
    const result = await prisma.round.groupBy({
      by: 'teamName',
      orderBy: { teamName: 'asc' },
    })

    expect(result).toEqual([
      {
        teamName: 'Blue',
      },
      {
        teamName: 'Red',
      },
    ])

    expectTypeOf(result).toMatchTypeOf<
      Array<{
        teamName: string
      }>
    >()
  })

  test('works with extended client', async () => {
    const result = await prisma.$extends({}).round.groupBy({
      by: 'teamName',
      orderBy: { teamName: 'asc' },
    })

    expect(result).toEqual([
      {
        teamName: 'Blue',
      },
      {
        teamName: 'Red',
      },
    ])

    expectTypeOf(result).toMatchTypeOf<
      Array<{
        teamName: string
      }>
    >()
  })
})
