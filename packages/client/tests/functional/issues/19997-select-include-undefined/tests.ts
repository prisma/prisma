import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient, User } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.user.create({ data: { email: 'user@example.com' } })
  })
  test('correctly infers selection when passing select: undefined', async () => {
    const user = await prisma.user.findFirstOrThrow({ select: undefined })
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).toMatchTypeOf<Partial<User>>()
  })

  test('correctly infers selection when passing include: undefined', async () => {
    const user = await prisma.user.findFirstOrThrow({ include: undefined })
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('email')
    expectTypeOf(user).toHaveProperty('id')
    expectTypeOf(user).toHaveProperty('email')
    expectTypeOf(user).toMatchTypeOf<Partial<User>>()
  })
})
