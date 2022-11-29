import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('should create a record using upsert', async () => {
    const name = faker.name.firstName()

    await prisma.user.upsert({
      where: {
        name,
      },
      create: {
        name,
      },
      update: {
        name,
      },
    })

    const count = await prisma.user.count({ where: { name } })

    expect(count).toEqual(1)
  })

  test('should update a record using upsert', async () => {
    const name = faker.name.firstName()

    await prisma.user.create({
      data: {
        name,
      },
    })

    await prisma.user.upsert({
      where: {
        name,
      },
      create: {
        name,
      },
      update: {
        name: name + 'new',
      },
    })

    let count = await prisma.user.count({ where: { name } })
    expect(count).toEqual(0)

    count = await prisma.user.count({ where: { name: name + 'new' } })
    expect(count).toEqual(1)
  })
})
