import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
const missing = faker.database.mongodbObjectId()

testMatrix.setupTestSuite((suiteConfig, suiteMeta, clientMeta) => {
  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  test('batched errors are serialized properly', async () => {
    const id = await prisma.user
      .create({
        data: {},
      })
      .then((u) => u.id)

    const id2 = await prisma.user
      .create({
        data: {},
      })
      .then((u) => u.id)

    const found = prisma.user.findUniqueOrThrow({ where: { id } })
    const foundToo = prisma.user.findUniqueOrThrow({ where: { id: id2 } })
    const result = await Promise.allSettled([found, foundToo])
    expect(result).toEqual([
      { status: 'fulfilled', value: { id: id } },
      { status: 'fulfilled', value: { id: id2 } },
    ])

    await prisma.user.delete({ where: { id: id2 } })

    const notFound = prisma.user.findUniqueOrThrow({ where: { id: missing } })
    const newResult = await Promise.allSettled([found, notFound])
    expect(newResult).toEqual([
      { status: 'fulfilled', value: { id: id } },
      { status: 'rejected', reason: expect.objectContaining({ code: 'P2025' }) },
    ])
  })
}, {})
