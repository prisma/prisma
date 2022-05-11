import { Decimal } from 'decimal.js'

import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix(() => {
  beforeAll(async () => {
    await prisma.user.create({
      data: { money: new Decimal('12.5') },
    })
  })

  test('decimal as Decimal.js instance', async () => {
    const result = await prisma.user.findFirst({
      where: {
        money: new Decimal('12.5'),
      },
    })

    expect(String(result?.money)).toBe('12.5')
  })

  test('decimal as string', async () => {
    const result = await prisma.user.findFirst({
      where: {
        money: '12.5',
      },
    })

    expect(String(result?.money)).toBe('12.5')
  })

  test('decimal as number', async () => {
    const result = await prisma.user.findFirst({
      where: {
        money: { gt: 12.4, lt: 12.6 },
      },
    })

    expect(String(result?.money)).toBe('12.5')
  })

  test('decimal as decimal.js-like object', async () => {
    const result = await prisma.user.findFirst({
      where: {
        money: {
          d: [12, 5000000],
          e: 1,
          s: 1,
        },
      },
    })

    expect(String(result?.money)).toBe('12.5')
  })
})
