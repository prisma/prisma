import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const email = copycat.email(12)

testMatrix.setupTestSuite(() => {
  beforeEach(async () => {
    await prisma.user.deleteMany({})
    await prisma.user.create({
      data: {
        email: email,
        age: 20,
        credit: 10.0,
      },
    })
  })

  test('atomic increment', async () => {
    const result = await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        credit: {
          increment: 1.5,
        },
        age: {
          increment: 1,
        },
      },
    })

    expect(result.credit).toBe(11.5)
    expect(result.age).toBe(21)
  })

  test('atomic decrement', async () => {
    const result = await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        credit: {
          decrement: 1.5,
        },
        age: {
          decrement: 1,
        },
      },
    })

    expect(result.credit).toBe(8.5)
    expect(result.age).toBe(19)
  })

  test('atomic increment with negative value', async () => {
    const result = await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        credit: {
          increment: -1.5,
        },
        age: {
          increment: -1,
        },
      },
    })

    expect(result.credit).toBe(8.5)
    expect(result.age).toBe(19)
  })

  test('atomic decrement with negative', async () => {
    const result = await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        credit: {
          decrement: -1.5,
        },
        age: {
          decrement: -1,
        },
      },
    })

    expect(result.credit).toBe(11.5)
    expect(result.age).toBe(21)
  })
})
