import { faker } from '@faker-js/faker'

import { AdapterProviders } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/15044
testMatrix.setupTestSuite(
  ({ driverAdapter }) => {
    // D1: iTx are not available.
    skipTestIf(driverAdapter === AdapterProviders.JS_D1)(
      'should not throw error when using connect inside transaction',
      async () => {
        const userName = faker.person.firstName()
        const walletName = faker.person.firstName()

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
      },
    )
  },
  {
    skipDriverAdapter: {
      from: [AdapterProviders.JS_LIBSQL],
      reason: 'js_libsql: SIGABRT due to panic in libsql (not yet implemented: array)', // TODO: ORM-867
    },
  },
)
