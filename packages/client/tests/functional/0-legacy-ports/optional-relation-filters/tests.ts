import { copycat } from '@snaplet/copycat'

import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './node_modules/@prisma/client'

declare let prisma: $.PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof $.PrismaClient>

// ported from: blog
testMatrix.setupTestSuite(
  (suiteConfig) => {
    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      await prisma.user.deleteMany()

      await prisma.user.create({
        data: {
          id: copycat.uuid(31).replaceAll('-', '').slice(-24),
          email: copycat.email(21),
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(62).replaceAll('-', '').slice(-24),
          email: copycat.email(52),
          bio: {
            create: {},
          },
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(51).replaceAll('-', '').slice(-24),
          email: copycat.email(37),
          bio: {
            create: {
              text: 'Hello World',
            },
          },
        },
      })
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter existing optional relation with `isNot: null`', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: { isNot: null },
        },
      })

      result.sort((a, b) => a.id.localeCompare(b.id))

      expect(result).toHaveLength(2)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Dolores_Padberg38680@languisheconomy.com,
            id: 7b77513e80f6999c9b07ad66,
          },
          {
            email: Palma_Bernhard71128@elementary-shoat.name,
            id: d794552b8e3babeb582906d3,
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter empty optional relation with ', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: { is: null },
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Lilyan_Emard89183@aquaplanecheetah.com,
            id: 23f75593b39583394b98c488,
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter empty optional relation with `null`', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: null,
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Lilyan_Emard89183@aquaplanecheetah.com,
            id: 23f75593b39583394b98c488,
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter empty optional relation', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: null,
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Lilyan_Emard89183@aquaplanecheetah.com,
            id: 23f75593b39583394b98c488,
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter existing optional relation with empty field', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: {
            text: null,
          },
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Palma_Bernhard71128@elementary-shoat.name,
            id: d794552b8e3babeb582906d3,
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== 'mongodb')('filter existing optional relation with existing field', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: {
            text: { not: null },
          },
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            email: Dolores_Padberg38680@languisheconomy.com,
            id: 7b77513e80f6999c9b07ad66,
          },
        ]
      `)
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
