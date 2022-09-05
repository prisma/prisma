import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  let id: string
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: faker.internet.email(), updateCount: 0 },
    })
    id = user.id
  })

  test('issue reproduction, single update', async () => {
    const result = prisma.$transaction([
      prisma.user.update({ where: { id }, data: { updateCount: 2 } }),
      prisma.user.delete({ where: { id } }),
      prisma.user.update({ where: { id }, data: { updateCount: 3 } }),
      prisma.user.delete({ where: { id } }),
    ])

    await expect(result).rejects.toThrowError()
    const user = await prisma.user.findFirstOrThrow()

    expect(user.updateCount).toBe(0)
  })

  test('issue reproduction, update many', async () => {
    const result = prisma.$transaction([
      prisma.user.updateMany({ where: { id }, data: { updateCount: 2 } }),
      prisma.user.delete({ where: { id } }),
      prisma.user.updateMany({ where: { id }, data: { updateCount: 3 } }),
      prisma.user.delete({ where: { id } }),
    ])

    await expect(result).rejects.toThrowError()
    const user = await prisma.user.findFirstOrThrow()

    expect(user.updateCount).toBe(0)
  })
})
