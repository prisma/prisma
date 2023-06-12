import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const email = faker.internet.email()

testMatrix.setupTestSuite(({ provider }, _, clientMeta) => {
  beforeEach(async () => {
    await prisma.post.deleteMany()
    await prisma.user.deleteMany()
    const { id: userId } = await prisma.user.create({
      data: {
        email,
        firstName: 'John',
        lastName: 'Smith',
      },
    })

    await prisma.post.create({
      data: {
        user: { connect: { id: userId } },
      },
    })
  })

  test('client is extended in itx', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute(user) {
              return `${user.firstName} ${user.lastName}`
            },
          },
        },
      },
    })

    await xprisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({})

      expect(user?.fullName).toBe('John Smith')
      expectTypeOf(user?.fullName).toEqualTypeOf<string | undefined>()
    })
  })

  testIf(clientMeta.runtime !== 'edge')('extended client in itx can rollback via normal call', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute(user) {
              return `${user.firstName} ${user.lastName}`
            },
          },
        },
      },
    })

    const result = xprisma.$transaction(async (tx) => {
      const userA = await tx.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      await tx.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      expectTypeOf(userA?.fullName).toEqualTypeOf<string>()
    })

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in itx works via normal call', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          fullName: {
            needs: { firstName: true, lastName: true },
            compute(user) {
              return `${user.firstName} ${user.lastName}`
            },
          },
        },
      },
    })

    await xprisma.$transaction(async (tx) => {
      const userA = await tx.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      expectTypeOf(userA?.fullName).toEqualTypeOf<string>()
    })

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })

  testIf(clientMeta.runtime !== 'edge')('extended client in itx can rollback via custom call', async () => {
    const xprisma = prisma
      .$extends({
        result: {
          user: {
            fullName: {
              needs: { firstName: true, lastName: true },
              compute(user) {
                return `${user.firstName} ${user.lastName}`
              },
            },
          },
        },
      })
      .$extends({
        model: {
          $allModels: {
            createAlt(args: any) {
              return (this as any).create(args)
            },
          },
        },
      })

    const result = xprisma.$transaction(async (tx) => {
      await tx.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      await tx.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })
    })

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in itx works via custom call', async () => {
    const xprisma = prisma
      .$extends({
        result: {
          user: {
            fullName: {
              needs: { firstName: true, lastName: true },
              compute(user) {
                return `${user.firstName} ${user.lastName}`
              },
            },
          },
        },
      })
      .$extends({
        model: {
          $allModels: {
            createAlt(args: any) {
              return (this as any).create(args)
            },
          },
        },
      })

    await xprisma.$transaction(async (tx) => {
      await tx.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })
    })

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })

  testIf(provider !== 'mongodb')('itx works with extended client + queryRawUnsafe', async () => {
    const xprisma = prisma.$extends({})

    await expect(
      xprisma.$transaction((tx) => {
        // @ts-test-if: provider !== 'mongodb'
        return tx.$queryRawUnsafe('SELECT 1')
      }),
    ).resolves.not.toThrow()
  })

  test('middleware exclude from transaction also works with extended client', async () => {
    const xprisma = prisma.$extends({})

    prisma.$use((params, next) => {
      return next({ ...params, runInTransaction: false })
    })

    const usersBefore = await xprisma.user.findMany()

    await xprisma
      .$transaction(async (prisma) => {
        await prisma.user.create({
          data: {
            email: 'jane@smith.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        })

        await prisma.user.create({
          data: {
            email: 'jane@smith.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        })
      })
      .catch(() => {})

    const usersAfter = await xprisma.user.findMany()

    expect(usersAfter).toHaveLength(usersBefore.length + 1)
  })

  test('client component is available within itx callback', async () => {
    const helper = jest.fn()
    const xprisma = prisma.$extends({
      client: {
        helper,
      },
    })

    await xprisma.$transaction((tx) => {
      tx.helper()
      return Promise.resolve()
    })

    expect(helper).toHaveBeenCalled()
  })

  test('methods from itx client denylist are optional within client extensions', async () => {
    expect.assertions(12)

    const xprisma = prisma.$extends({
      client: {
        testContextMethods(isTransaction: boolean) {
          const ctx = Prisma.getExtensionContext(this)

          expectTypeOf(ctx.$connect).toEqualTypeOf<typeof prisma.$connect | undefined>()
          expectTypeOf(ctx.$disconnect).toEqualTypeOf<typeof prisma.$disconnect | undefined>()
          expectTypeOf(ctx.$transaction).toEqualTypeOf<typeof prisma.$transaction | undefined>()
          expectTypeOf(ctx.$extends).toEqualTypeOf<typeof prisma.$extends | undefined>()
          expectTypeOf(ctx).not.toHaveProperty('$use')
          expectTypeOf(ctx).not.toHaveProperty('$on')

          expect(ctx['$use']).toBeUndefined()
          expect(ctx['$on']).toBeUndefined()

          if (isTransaction) {
            expect(ctx.$connect).toBeUndefined()
            expect(ctx.$disconnect).toBeUndefined()
            expect(ctx.$transaction).toBeUndefined()
            expect(ctx.$extends).toBeUndefined()
          } else {
            expect(ctx.$connect).toBeDefined()
            expect(ctx.$disconnect).toBeDefined()
            expect(ctx.$transaction).toBeDefined()
            expect(ctx.$extends).toBeDefined()
          }
        },
      },
      model: {
        user: {
          helper() {},
        },
      },
    })

    xprisma.testContextMethods(false)

    await xprisma.$transaction((tx) => {
      tx.testContextMethods(true)
      return Promise.resolve()
    })
  })
})
