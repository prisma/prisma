import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

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

    test('group', async () => {
      const users = await prisma.user.aggregateRaw({
        pipeline: [{ $group: { _id: '$age', total: { $sum: 1 } } }, { $sort: { _id: -1 } }],
      })

      expect(users).toMatchInlineSnapshot(`
        [
          {
            "_id": 60,
            "total": 2,
          },
          {
            "_id": 45,
            "total": 1,
          },
          {
            "_id": 20,
            "total": 1,
          },
        ]
      `)
    })

    test('match', async () => {
      const users = await prisma.user.aggregateRaw({
        pipeline: [{ $match: { age: 60 } }, { $project: { email: true, _id: false } }],
      })

      expect(users).toMatchInlineSnapshot(`
        [
          {
            "email": "Kyla_Beer587@fraternise-assassination.name",
          },
          {
            "email": "Arielle.Reichel85426@hunker-string.org",
          },
        ]
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
