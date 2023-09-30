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
          id: copycat.uuid(11).replaceAll('-', '').slice(-24),
          email: copycat.email(51),
          age: 20,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(42).replaceAll('-', '').slice(-24),
          email: copycat.email(82),
          age: 45,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(33).replaceAll('-', '').slice(-24),
          email: copycat.email(93),
          age: 60,
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(14).replaceAll('-', '').slice(-24),
          email: copycat.email(54),
          age: 63,
        },
      })
    })

    test('all', async () => {
      const users = await prisma.user.findRaw({})
      expect(users).toMatchInlineSnapshot(`
        [
          {
            _id: {
              $oid: 02d25579a73a72373fa4e846,
            },
            age: 20,
            email: Pete.Runte93767@broaden-dungeon.info,
          },
          {
            _id: {
              $oid: a85d5d75a3a886cb61eb3a0e,
            },
            age: 45,
            email: Sam.Mills50272@oozeastronomy.net,
          },
          {
            _id: {
              $oid: a7fe5dac91ab6b0f529430c5,
            },
            age: 60,
            email: Kyla_Beer587@fraternise-assassination.name,
          },
          {
            _id: {
              $oid: 40b15492abe23e6fce736dad,
            },
            age: 63,
            email: Arielle.Reichel85426@hunker-string.org,
          },
        ]
      `)
    })

    test('filtered', async () => {
      const users = await prisma.user.findRaw({ filter: { age: 60 } })

      expect(users).toMatchInlineSnapshot(`
        [
          {
            _id: {
              $oid: a7fe5dac91ab6b0f529430c5,
            },
            age: 60,
            email: Kyla_Beer587@fraternise-assassination.name,
          },
        ]
      `)
    })

    test('projection', async () => {
      const users = await prisma.user.findRaw({
        filter: { age: 60 },
        options: { projection: { _id: false } },
      })

      expect(users).toMatchInlineSnapshot(`
        [
          {
            age: 60,
            email: Kyla_Beer587@fraternise-assassination.name,
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
