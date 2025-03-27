import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './generated/prisma/client'

declare let prisma: $.PrismaClient

// ported from: blog
testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({
        data: {
          id: copycat.uuid(1).replaceAll('-', '').slice(-24),
          email: copycat.email(1),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(2).replaceAll('-', '').slice(-24),
          email: copycat.email(2),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(3).replaceAll('-', '').slice(-24),
          email: copycat.email(3),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(4).replaceAll('-', '').slice(-24),
          email: copycat.email(4),
          age: 60,
        },
      })
    })

    test('aggregate', async () => {
      const users = await prisma.$runCommandRaw({
        aggregate: 'User',
        pipeline: [{ $match: { age: 60 } }, { $project: { email: true, _id: false } }],
        explain: false,
      })

      delete users?.['cursor']?.['ns'] // delete irrelevant field

      expect(users).toMatchInlineSnapshot(`
        {
          "cursor": {
            "firstBatch": [
              {
                "email": "Kyla_Crist96556@cancollaboration.biz",
              },
              {
                "email": "Arielle.Oberbrunner94321@fulljuggernaut.org",
              },
            ],
            "id": 0,
          },
          "ok": 1,
        }
      `)
    })
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason: 'This is a MongoDB specific feature',
    },
  },
)
