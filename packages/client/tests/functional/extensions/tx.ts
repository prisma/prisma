import { copycat } from '@snaplet/copycat'
import { expectTypeOf } from 'expect-type'

import { ProviderFlavors } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const email = copycat.email(67)

testMatrix.setupTestSuite(({ providerFlavor }, _1, clientMeta) => {
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

  // TODO fails with UNIQUE constraint failed: User.email AND Expected instance of error
  testIf(clientMeta.runtime !== 'edge' && providerFlavor !== ProviderFlavors.JS_LIBSQL)(
    'extended client in tx can rollback via normal call',
    async () => {
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
    },
  )

  testIf(clientMeta.runtime !== 'edge')('extended client in tx works via normal call', async () => {
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

  // TODO fails with: Expected instance of error
  testIf(clientMeta.runtime !== 'edge' && providerFlavor !== ProviderFlavors.JS_LIBSQL)(
    'extended client in tx can rollback via custom call',
    async () => {
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
    },
  )

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

  testIf(clientMeta.runtime !== 'edge')('isolation level is properly reflected in extended client', () => {
    ;async () => {
      const xprisma = prisma.$extends({})

      // @ts-test-if: provider !== 'mongodb'
      const data = await xprisma.$transaction([xprisma.user.findFirst({ select: { id: true } })], {
        isolationLevel: 'Serializable',
      })

      expectTypeOf(data).toEqualTypeOf<[{ id: string } | null]>()
    }
  })

  test('type inference allows for destructuring the array', () => {
    ;async () => {
      const xprisma = prisma.$extends({})

      const [data, count] = await xprisma.$transaction([
        xprisma.user.findFirst({ select: { id: true } }),
        xprisma.user.count(),
      ])

      expectTypeOf(data).toEqualTypeOf<{ id: string } | null>()
      expectTypeOf(count).toEqualTypeOf<number>()
    }
  })
})
