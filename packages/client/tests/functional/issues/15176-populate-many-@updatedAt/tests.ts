import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/15176
testMatrix.setupTestSuite(({ provider }) => {
  const getTime = (dt: Date): number => dt.getTime()

  test('should update both updatedAt fields on a model', async () => {
    const id = provider === 'mongodb' ? faker.database.mongodbObjectId() : faker.random.alpha(10)

    const created = await prisma.testModel.create({
      data: {
        id,
      },
    })

    expect(created.updatedAt_w_default).toBeTruthy()
    expect(created.updatedAt_wo_default).toBeTruthy()

    expect(getTime(created.updatedAt_w_default)).toEqual(getTime(created.createdAt))
    expect(getTime(created.updatedAt_wo_default!)).toEqual(getTime(created.createdAt))

    const updated = await prisma.testModel.update({
      where: {
        id,
      },
      data: {
        bool: false,
      },
    })

    expect(getTime(updated.updatedAt_w_default)).toBeGreaterThan(getTime(created.updatedAt_w_default))

    expect(getTime(updated.updatedAt_w_default)).toEqual(getTime(updated.updatedAt_wo_default!))
  })
})
