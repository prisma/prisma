import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const email = faker.internet.email()

testMatrix.setupTestSuite((_0, _1, clientMeta) => {
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

  test('methods from itx client denylist are optional within client extensions', async () => {
    expect.assertions(10)
    const xprisma = prisma.$extends({
      client: {
        testContextMethods(isTransaction: boolean) {
          const ctx = Prisma.getExtensionContext(this)

          expectTypeOf(ctx.$connect).toEqualTypeOf<typeof prisma.$connect | undefined>()
          expectTypeOf(ctx.$disconnect).toEqualTypeOf<typeof prisma.$disconnect | undefined>()
          expectTypeOf(ctx.$transaction).toEqualTypeOf<typeof prisma.$transaction | undefined>()
          expectTypeOf(ctx.$on).toEqualTypeOf<typeof prisma.$on | undefined>()
          expectTypeOf(ctx.$extends).toEqualTypeOf<typeof prisma.$extends | undefined>()
          expectTypeOf(ctx).not.toHaveProperty('$use')

          if (isTransaction) {
            expect(ctx.$connect).toBeUndefined()
            expect(ctx.$disconnect).toBeUndefined()
            expect(ctx.$transaction).toBeUndefined()
            expect(ctx.$on).toBeUndefined()
            expect(ctx.$extends).toBeUndefined()
          } else {
            expect(ctx.$connect).toBeDefined()
            expect(ctx.$disconnect).toBeDefined()
            expect(ctx.$transaction).toBeDefined()
            expect(ctx.$on).toBeDefined()
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
