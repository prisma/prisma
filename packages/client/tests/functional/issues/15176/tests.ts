import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/15176
testMatrix.setupTestSuite(({ provider }) => {
  test('should update both updatedAt fields on a model', async () => {
    const id = provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.alpha(10)

    const created = await prisma.TestModel.create({
      data: {
        id,
      },
    })

    expect(created.updatedAt_wo_default).toEqual(null)
    expect(new Date(created.updatedAt_w_default).toISOString()).toEqual(new Date(created.createdAt).toISOString())

    const updated = await prisma.TestModel.update({
      where: {
        id,
      },
      data: {
        test: false,
      },
    })

    expect(new Date(updated.updatedAt_w_default).getTime()).toBeGreaterThan(
      new Date(created.updatedAt_w_default).getTime(),
    )

    expect(new Date(updated.updatedAt_w_default).toISOString()).toEqual(
      new Date(updated.updatedAt_wo_default).toISOString(),
    )
  })
})
