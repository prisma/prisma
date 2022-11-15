// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9372
testMatrix.setupTestSuite(
  () => {
    jest.setTimeout(120_000)
    test('does not crash on large amount of items inserted', async () => {
      const result = prisma.dictionary.create({
        data: {
          entries: {
            create: Array.from({ length: 150_000 }).map(() => ({
              term: 'foo',
            })),
          },
        },
      })

      await expect(result).resolves.not.toThrowError()
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: `
        This test is fairly slow and the issue it is testing is not provider-dependent.
        Just for the sake of keeping test times acceptable, we are testing it only on sqlite
      `,
    },
  },
)
