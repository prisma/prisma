import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  afterEach(async () => {
    await prisma.item.deleteMany()
  })

  beforeEach(async () => {
    await prisma.item.createMany({
      data: [
        { id: 'one', price: 10 },
        { id: 'two', price: 20 },
        { id: 'three', price: 30 },
        { id: 'four', price: 40 },
      ],
    })
  })

  test('correctly handles two subsequent queries with a different cursor', async () => {
    const ORDER_BY_NULLABLE = [{ price: 'asc' as const }, { id: 'asc' as const }]

    const result1 = await prisma.item.findMany({
      orderBy: ORDER_BY_NULLABLE,
      cursor: { id: 'one' },
      skip: 1,
      take: 1,
    })
    expect(result1).toEqual([{ id: 'two', price: 20 }])

    const result2 = await prisma.item.findMany({
      orderBy: ORDER_BY_NULLABLE,
      cursor: { id: 'two' },
      skip: 1,
      take: 1,
    })
    expect(result2).toEqual([{ id: 'three', price: 30 }])
  })
})
