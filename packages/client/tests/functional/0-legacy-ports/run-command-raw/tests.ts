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
          id: copycat.uuid(51).replaceAll('-', '').slice(-24),
          email: copycat.email(11),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(82).replaceAll('-', '').slice(-24),
          email: copycat.email(92),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(31).replaceAll('-', '').slice(-24),
          email: copycat.email(13),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(94).replaceAll('-', '').slice(-24),
          email: copycat.email(48),
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
          cursor: {
            firstBatch: [
              {
                email: Kyla_Beer587@fraternise-assassination.name,
              },
              {
                email: Arielle.Reichel85426@hunker-string.org,
              },
            ],
            id: 0,
          },
          ok: 1,
        }
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
