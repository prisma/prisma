import { copycat } from '@snaplet/copycat'

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
          id: copycat.uuid(14).replaceAll('-', '').slice(-24),
          email: copycat.email(41),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(12).replaceAll('-', '').slice(-24),
          email: copycat.email(28),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(13).replaceAll('-', '').slice(-24),
          email: copycat.email(73),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(49).replaceAll('-', '').slice(-24),
          email: copycat.email(54),
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
            _id: 60,
            total: 2,
          },
          {
            _id: 45,
            total: 1,
          },
          {
            _id: 20,
            total: 1,
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
            email: Kyla_Beer587@fraternise-assassination.name,
          },
          {
            email: Arielle.Reichel85426@hunker-string.org,
          },
        ]
      `)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'sqlserver', 'sqlite', 'mysql', 'postgresql'],
      reason: 'This is a MongoDB specific feature',
    },
  },
)
