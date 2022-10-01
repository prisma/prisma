import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  const dateInput1 = '2011-01-01T00:00:00Z'
  const dateInput2 = '2022-02-02T00:00:00Z'
  const dateOutput1 = new Date(dateInput1)
  const dateOutput2 = new Date(dateInput2)

  beforeAll(async () => {
    await prisma.resource.create({
      data: { date: dateInput1 },
    })
    await prisma.resource.create({
      data: { date: dateInput2 },
    })
  })

  test('findUnique date with Promise.all', async () => {
    const result = await Promise.all([
      prisma.resource.findUnique({
        where: { date: dateInput1 },
        select: { date: true },
      }),
      prisma.resource.findUnique({
        where: { date: dateInput2 },
        select: { date: true },
      }),
    ])

    expect(result).toMatchObject([{ date: dateOutput1 }, { date: dateOutput2 }])
  })

  test('findUnique date with $transaction([...])', async () => {
    const result = await prisma.$transaction([
      prisma.resource.findUnique({
        where: { date: dateInput1 },
        select: { date: true },
      }),
      prisma.resource.findUnique({
        where: { date: dateInput2 },
        select: { date: true },
      }),
    ])

    expect(result).toMatchObject([{ date: dateOutput1 }, { date: dateOutput2 }])
  })

  test('findFirst date with Promise.all', async () => {
    const result = await Promise.all([
      prisma.resource.findFirst({
        where: { date: dateInput1 },
        select: { date: true },
      }),
      prisma.resource.findFirst({
        where: { date: dateInput2 },
        select: { date: true },
      }),
    ])

    expect(result).toMatchObject([{ date: dateOutput1 }, { date: dateOutput2 }])
  })

  test('findFirst date with $transaction([...])', async () => {
    const result = await prisma.$transaction([
      prisma.resource.findFirst({
        where: { date: dateInput1 },
        select: { date: true },
      }),
      prisma.resource.findFirst({
        where: { date: dateInput2 },
        select: { date: true },
      }),
    ])

    expect(result).toMatchObject([{ date: dateOutput1 }, { date: dateOutput2 }])
  })
})
