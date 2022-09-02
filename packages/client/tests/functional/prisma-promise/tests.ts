import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(({ provider }) => {
  const tests = [
    [
      'create',
      (email: string) => {
        return prisma.user.create({
          data: {
            email,
          },
        })
      },
    ],
    ...(provider !== 'sqlite'
      ? [
          [
            'createMany',
            (email: string) => {
              // @ts-test-if: provider !== 'sqlite'
              return prisma.user.createMany({
                data: [
                  {
                    email,
                  },
                ],
              })
            },
          ],
        ]
      : []),
    [
      'findMany',
      (email: string) => {
        return prisma.user.findMany({
          where: {
            email,
          },
        })
      },
    ],
    [
      'findFirst',
      (email: string) => {
        return prisma.user.findFirst({
          where: {
            email,
          },
        })
      },
    ],
    [
      'findUnique',
      (email: string) => {
        return prisma.user.findUnique({
          where: {
            email,
          },
        })
      },
    ],
    [
      'findUniqueOrThrow',
      (email: string) => {
        return prisma.user.findUniqueOrThrow({
          where: {
            email,
          },
        })
      },
    ],
    [
      'findFirstOrThrow',
      (email: string) => {
        return prisma.user.findFirstOrThrow({
          where: {
            email,
          },
        })
      },
    ],
    [
      'update',
      (email: string) => {
        return prisma.user.update({
          where: {
            email,
          },
          data: {
            email,
          },
        })
      },
    ],
    [
      'updateMany',
      (email: string) => {
        return prisma.user.updateMany({
          where: {
            email,
          },
          data: {
            email,
          },
        })
      },
    ],
    [
      'delete',
      (email: string) => {
        return prisma.user.delete({
          where: {
            email,
          },
        })
      },
    ],
    [
      'deleteMany',
      (email: string) => {
        return prisma.user.deleteMany({
          where: {
            email,
          },
        })
      },
    ],
    [
      'aggregate',
      (email: string) => {
        return prisma.user.aggregate({
          where: {
            email,
          },
          _count: true,
        })
      },
    ],
    [
      'count',
      (email: string) => {
        return prisma.user.count({
          where: {
            email,
          },
        })
      },
    ],
    ...(provider !== 'mongodb'
      ? [
          [
            '$queryRaw',
            () => {
              // @ts-test-if: provider !== 'mongodb'
              return prisma.$queryRaw`SELECT 1 + 1;`
            },
          ],
          [
            '$queryRawUnsafe',
            () => {
              // @ts-test-if: provider !== 'mongodb'
              return prisma.$queryRawUnsafe(`SELECT 1 + 1;`)
            },
          ],
          ...(provider !== 'sqlite'
            ? [
                [
                  '$executeRaw',
                  () => {
                    // @ts-test-if: provider !== 'mongodb'
                    return prisma.$executeRaw`SELECT 1 + 1;`
                  },
                ],
                [
                  '$executeRawUnsafe',
                  () => {
                    // @ts-test-if: provider !== 'mongodb'
                    return prisma.$executeRawUnsafe(`SELECT 1 + 1;`)
                  },
                ],
              ]
            : []),
        ]
      : []),
    ...(provider === 'mongodb'
      ? [
          [
            '$runCommandRaw',
            () => {
              // @ts-test-if: provider === 'mongodb'
              return prisma.$runCommandRaw({
                aggregate: 'User',
                pipeline: [{ $match: { name: 'A' } }, { $project: { email: true, _id: false } }],
                explain: false,
              })
            },
          ],
        ]
      : []),
  ] as Array<[string, (email: string) => any]>

  describe.each(tests)('%s', (name, fn) => {
    const email = faker.internet.email()
    const createPromise = () => {
      return fn(email)
    }

    beforeEach(async () => {
      if (
        ['delete', 'deleteMany', 'update', 'updateMany', 'findFirstOrThrow', 'findUniqueOrThrow'].includes(
          name as string,
        )
      ) {
        await prisma.user.create({ data: { email } })
      }
    })

    afterEach(async () => {
      try {
        await prisma.user.delete({ where: { email } })
      } catch (error) {
        // ignore
      }
    })

    test('repeated calls to .then', async () => {
      const promise = createPromise()

      // repeated calls to then should not change the result
      const res1 = await promise.then()
      const res2 = await promise.then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .catch', async () => {
      const promise = createPromise()

      // repeated calls to catch should not change the result
      const res1 = await promise.catch()
      const res2 = await promise.catch()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .finally', async () => {
      const promise = createPromise()

      // repeated calls to finally should not change the result
      const res1 = await promise.finally()
      const res2 = await promise.finally()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated mixed calls to .then, .catch, .finally', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.finally().then().catch()
      const res2 = await promise.catch().finally().then()

      expect(res1).toStrictEqual(res2)
    })

    test('repeated calls to .requestTransaction', async () => {
      const promise = createPromise()

      // repeated calls to then & co should not change the result
      const res1 = await promise.requestTransaction(1)
      const res2 = await promise.requestTransaction(1)

      expect(res1).toStrictEqual(res2)
    })

    test('fluent promises should have promise properties', async () => {
      const promise = createPromise()

      expect('then' in promise).toBe(true)
      expect('finally' in promise).toBe(true)
      expect('catch' in promise).toBe(true)

      await promise.finally()
    })
  })
})
