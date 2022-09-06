import { permutations } from '../../../../../../helpers/blaze/permutations'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9248
testMatrix.setupTestSuite(
  () => {
    async function expectCreateToSucceed(words: string[]) {
      const result = await prisma.post.create({
        data: { words },
      })

      expect(result.words).toEqual(words)

      const readBack = await prisma.post.findUnique({
        where: {
          id: result.id,
        },
      })

      expect(readBack?.words).toEqual(words)
    }

    test('create with two strings', async () => {
      await expectCreateToSucceed(['hello', 'world'])
    })

    test('create with a string that looks like a date', async () => {
      await expectCreateToSucceed(['2022-09-06T16:31:16.269Z'])
      await expectCreateToSucceed(['2022-09-06T16:31:16.269Z', '2021-09-14T00:00:00.000Z'])
    })

    // TODO: this is a bug
    test.failing('create with a string and a string that looks like a date', async () => {
      await expectCreateToSucceed(['hello', '2022-09-06T16:31:16.269Z'])
      await expectCreateToSucceed(['2022-09-06T16:31:16.269Z', 'hello'])
    })

    test('create a string that looks like a uuid', async () => {
      await expectCreateToSucceed(['4464dcac-809d-4f01-8642-81d637cd7cdd'])
      await expectCreateToSucceed(['4464dcac-809d-4f01-8642-81d637cd7cdd', '2690FE4B-BB1C-4278-8022-9C029C2248C8'])
    })

    test('create with a string and a string that looks like a uuid', async () => {
      // Check both lowercase and uppercase UUID in different order
      await expectCreateToSucceed(['hello', '4464dcac-809d-4f01-8642-81d637cd7cdd'])
      await expectCreateToSucceed(['2690FE4B-BB1C-4278-8022-9C029C2248C8', 'world'])
    })

    // TODO: this is a bug
    test.failing('create with a date and uuid', async () => {
      await expectCreateToSucceed(['2022-09-06T16:31:16.269Z', '4464dcac-809d-4f01-8642-81d637cd7cdd'])
      await expectCreateToSucceed(['2690FE4B-BB1C-4278-8022-9C029C2248C8', '2021-09-14T00:00:00.000Z'])
    })

    // TODO: this is a bug
    test.failing('create with a string, date and uuid', async () => {
      const words = ['hello', '2022-09-06T16:31:16.269Z', '4464dcac-809d-4f01-8642-81d637cd7cdd']

      // Check all possible permutations because there are six possible GraphQL
      // types that the validator can infer: `List<String | DateTime | UUID>`,
      // `List<DateTime | String | UUID` and so on.
      for (const permutedWords of permutations(words)) {
        await expectCreateToSucceed(permutedWords)
      }
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'sqlserver'],
      reason: 'Scalar lists are not supported in all databases',
    },
  },
)
