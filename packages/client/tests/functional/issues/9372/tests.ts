import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider }) => {
  jest.setTimeout(120_000)
  test.failing('does not crash on large amount of items insert', async () => {
    const result = prisma.dictionary.create({
      data: {
        entries: {
          create: Array.from({ length: 150_000 }).map(() => ({
            term: faker.lorem.word(),
          })),
        },
      },
    })

    await expect(result).resolves.not.toThrowError()
  })

  testIf(provider !== 'sqlite')('does not crash on createMany', async () => {
    // @ts-test-if: provider !== 'sqlite'
    const result = prisma.entry.createMany({
      data: Array.from({ length: 150_000 }).map(() => ({
        term: faker.lorem.word(),
      })),
    })

    await expect(result).resolves.not.toThrowError()
  })
})
