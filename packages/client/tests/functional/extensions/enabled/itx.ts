import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const email = faker.internet.email()

testMatrix.setupTestSuite(() => {
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

  test('extended client in itx can rollback via normal call', async () => {
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

      const userB = await tx.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      expectTypeOf(userA?.fullName).toEqualTypeOf<string>()
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`tx.user.create()\` invocation in
      /client/tests/functional/extensions/enabled/itx.ts:0:0

        XX   },
        XX })
        XX 
      → XX const userB = await tx.user.create(
      Unique constraint failed on the fields: (\`email\`)
    `)

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

  test('extended client in itx can rollback via custom call', async () => {
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
      const userA = await tx.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })

      const userB = await tx.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      })
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`
      Error caused by an extension: 
      Invalid \`prisma.user.create()\` invocation:


      Unique constraint failed on the fields: (\`email\`)
    `)

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
})
