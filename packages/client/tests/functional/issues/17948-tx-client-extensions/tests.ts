import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  test('extension method is bound to transaction client within itx', async () => {
    const email = faker.internet.email()

    const xprisma = prisma.$extends({
      model: {
        user: {
          async exists(email: string) {
            const user = await Prisma.getExtensionContext(this).findFirst({ where: { email } })
            return user !== null
          },
        },
      },
      client: {
        foo() {
          Prisma.getExtensionContext(this)
        },
      },
    })

    const existsWithinTransaction = await xprisma.$transaction(async (tx) => {
      await tx.user.create({ data: { email } })
      const result = await tx.user.exists(email)
      return result
    })

    expect(existsWithinTransaction).toBe(true)
  })
})
