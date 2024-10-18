import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// See: https://github.com/prisma/prisma/issues/21306
testMatrix.setupTestSuite(
  () => {
    test('findUnique without @unique field', async () => {
      const result = await prisma.user.findUnique({
        where: {
          one_two: {
            one: '1234',
            two: '1234zc',
          },
        },
      })

      expect(result).toMatchInlineSnapshot(`null`)
    })

    test('findUnique with @unique field', async () => {
      const error = prisma.userUnique.findUnique({
        where: {
          meme: {
            one: '1234',
            two: '1234zc',
          },
        },
      })

      await expect(error).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining('called `Option::unwrap()` on a `None` value'),
        }),
      )
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'sqlserver', 'sqlite', 'mysql', 'postgresql'],
      reason: 'This is a MongoDB specific schema',
    },
  },
)
