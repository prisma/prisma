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

  test('extended client in tx can rollback via normal call', async () => {
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

    const result = xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in tx works via normal call', async () => {
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

    await xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })

  test('extended client in tx can rollback via custom call', async () => {
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

    const result = xprisma.$transaction([
      xprisma.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
      xprisma.user.createAlt({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(0)
  })

  test('extended client in tx works via custom call', async () => {
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

    await xprisma.$transaction([
      xprisma.user.create({
        data: {
          email: 'jane@smith.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      }),
    ])

    const users = await prisma.user.findMany({ where: { email: 'jane@smith.com' } })

    expect(users).toHaveLength(1)
  })
})
