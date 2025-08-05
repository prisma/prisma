import { copycat } from '@snaplet/copycat'

import { Providers } from '../../_utils/providers'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type * as $ from './generated/prisma/client'

declare let prisma: $.PrismaClient
declare let newPrismaClient: NewPrismaClient<$.PrismaClient, typeof $.PrismaClient>

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
          id: copycat.uuid(1).replaceAll('-', '').slice(-24),
          email: copycat.email(1),
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(2).replaceAll('-', '').slice(-24),
          email: copycat.email(2),
          bio: {
            create: {},
          },
        },
      })
      await prisma.user.create({
        data: {
          id: copycat.uuid(3).replaceAll('-', '').slice(-24),
          email: copycat.email(3),
          bio: {
            create: {
              text: 'Hello World',
            },
          },
        },
      })
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)(
      'filter existing optional relation with `isNot: null`',
      async () => {
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
              "email": "Kyla_Crist96556@cancollaboration.biz",
              "id": "a7fe5dac91ab6b0f529430c5",
            },
            {
              "email": "Sam.Dickinson32909@memorableparticular.org",
              "id": "a85d5d75a3a886cb61eb3a0e",
            },
          ]
        `)
      },
    )

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)('filter empty optional relation with ', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: { is: null },
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "email": "Pete.Kassulke82520@fox-min.com",
            "id": "02d25579a73a72373fa4e846",
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)('filter empty optional relation with `null`', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: null,
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "email": "Pete.Kassulke82520@fox-min.com",
            "id": "02d25579a73a72373fa4e846",
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)('filter empty optional relation', async () => {
      const result = await prisma.user.findMany({
        where: {
          bio: null,
        },
      })

      expect(result).toHaveLength(1)
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "email": "Pete.Kassulke82520@fox-min.com",
            "id": "02d25579a73a72373fa4e846",
          },
        ]
      `)
    })

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)(
      'filter existing optional relation with empty field',
      async () => {
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
              "email": "Sam.Dickinson32909@memorableparticular.org",
              "id": "a85d5d75a3a886cb61eb3a0e",
            },
          ]
        `)
      },
    )

    // TODO likely a bug in mongodb
    testIf(suiteConfig.provider !== Providers.MONGODB)(
      'filter existing optional relation with existing field',
      async () => {
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
              "email": "Kyla_Crist96556@cancollaboration.biz",
              "id": "a7fe5dac91ab6b0f529430c5",
            },
          ]
        `)
      },
    )
  },
  {
    skipDefaultClientInstance: true,
  },
)
