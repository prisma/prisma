// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('does not crash on large amount of items inserted', async () => {
      jest.setTimeout(120_000)
      const numberOfEntries = 150_000

      const result = prisma.dictionary.create({
        data: {
          entries: {
            create: Array.from({ length: numberOfEntries }).map(() => ({
              term: 'foo',
            })),
          },
        },
      })

      await expect(result).resolves.not.toThrow()
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
    skipDriverAdapter: {
      from: ['js_d1'],
      reason: `
        The test is too slow when using the d1 driver adapter
        Also it's not testing the same thing, as each statement will be executed separately at the moment 
        (because there is no transaction API)
      `,
    },
  },
)
