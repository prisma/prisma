import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('batch does not times out', async () => {
    const results = Promise.all(
      Array.from({ length: 25 }).map(() =>
        prisma.post.findUnique({
          where: {
            id: faker.database.mongodbObjectId(),
            OR: [{ author: { id: faker.database.mongodbObjectId() } }],
          },
        }),
      ),
    )

    await expect(results).resolves.not.toThrow()
  })
})
