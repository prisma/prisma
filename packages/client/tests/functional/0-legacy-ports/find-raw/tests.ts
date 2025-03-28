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
          age: 63,
        },
      })
    })

    test('all', async () => {
      const users = await prisma.user.findRaw({})
      expect(users).toMatchInlineSnapshot(`
        [
          {
            "_id": {
              "$oid": "02d25579a73a72373fa4e846",
            },
            "age": 20,
            "email": "Pete.Kassulke82520@fox-min.com",
          },
          {
            "_id": {
              "$oid": "a85d5d75a3a886cb61eb3a0e",
            },
            "age": 45,
            "email": "Sam.Dickinson32909@memorableparticular.org",
          },
          {
            "_id": {
              "$oid": "a7fe5dac91ab6b0f529430c5",
            },
            "age": 60,
            "email": "Kyla_Crist96556@cancollaboration.biz",
          },
          {
            "_id": {
              "$oid": "40b15492abe23e6fce736dad",
            },
            "age": 63,
            "email": "Arielle.Oberbrunner94321@fulljuggernaut.org",
          },
        ]
      `)
    })

    test('filtered', async () => {
      const users = await prisma.user.findRaw({ filter: { age: 60 } })

      expect(users).toMatchInlineSnapshot(`
        [
          {
            "_id": {
              "$oid": "a7fe5dac91ab6b0f529430c5",
            },
            "age": 60,
            "email": "Kyla_Crist96556@cancollaboration.biz",
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
            "age": 60,
            "email": "Kyla_Crist96556@cancollaboration.biz",
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
