import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/15044
testMatrix.setupTestSuite(
  () => {
    test('should not throw error when using connect inside transaction', async () => {
      const userName = faker.name.firstName()
      const walletName = faker.name.firstName()

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: userName,
          },
        })

        const wallet = await tx.wallet.create({
          data: {
            name: walletName,
          },
        })

        const walletLink = await tx.walletLink.create({
          data: {
            name: `${userName}-${walletName}`,
            wallet: {
              connect: {
                id: wallet.id,
              },
            },
            user: {
              connect: {
                id: user.id,
              },
            },
          },
          select: {
            id: true,
            name: true,
            wallet: true,
            user: true,
          },
        })

        return walletLink
      })

      expect(result.wallet.name).toEqual(walletName)
      expect(result.user.name).toEqual(userName)
    })
  },
  {
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: 'Interactive transactions are not supported with Data Proxy yet',
    },
  },
)
