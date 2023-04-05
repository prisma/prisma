import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
const missing = faker.database.mongodbObjectId()

testMatrix.setupTestSuite(() => {
  let id1: string
  let id2: string
  beforeAll(async () => {
    id1 = await prisma.user
      .create({
        data: {},
      })
      .then((user) => user.id)

    id2 = await prisma.user
      .create({
        data: {},
      })
      .then((user) => user.id)
  })

  test('batched errors are when all objects in batch are found', async () => {
    const found = prisma.user.findUniqueOrThrow({ where: { id: id1 } })
    const foundToo = prisma.user.findUniqueOrThrow({ where: { id: id2 } })
    const result = await Promise.allSettled([found, foundToo])
    expect(result).toEqual([
      { status: 'fulfilled', value: { id: id1 } },
      { status: 'fulfilled', value: { id: id2 } },
    ])
  })

  test('batched errors when some of the objects not found', async () => {
    const found = prisma.user.findUniqueOrThrow({ where: { id: id1 } })
    const notFound = prisma.user.findUniqueOrThrow({ where: { id: missing } })
    const newResult = await Promise.allSettled([found, notFound])
    expect(newResult).toEqual([
      { status: 'fulfilled', value: { id: id1 } },
      { status: 'rejected', reason: expect.objectContaining({ code: 'P2025' }) },
    ])
  })
}, {})
