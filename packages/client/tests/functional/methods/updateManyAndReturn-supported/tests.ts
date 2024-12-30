import { faker } from '@faker-js/faker'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should update and return many records', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()
      const email3 = faker.internet.email()
      const email4 = faker.internet.email()

      const updatedName = faker.person.fullName()

      await prisma.user.createMany({
        data: [
          {
            email: email1,
          },
          {
            email: email2,
          },
          {
            email: email3,
          },
          {
            email: email4,
          },
        ],
      })

      const users = await prisma.user.updateManyAndReturn({
        data: {
          name: updatedName,
        },
        where: {},
      })

      expect(users).toMatchObject([
        {
          email: email1,
          id: expect.any(String),
          name: updatedName,
        },
        {
          email: email2,
          id: expect.any(String),
          name: updatedName,
        },
        {
          email: email3,
          id: expect.any(String),
          name: updatedName,
        },
        {
          email: email4,
          id: expect.any(String),
          name: updatedName,
        },
      ])
    })

    test('should update and return one record', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()

      await prisma.user.create({
        data: {
          email: email1,
        },
      })

      const users = await prisma.user.updateManyAndReturn({
        data: {
          email: email2,
        },
        where: {
          email: email1,
        },
      })

      expect(users).toMatchObject([
        {
          email: email2,
          id: expect.any(String),
          name: null,
        },
      ])
    })

    test('should update and return records satisfying the where clause', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()
      const email3 = faker.internet.email()
      const email4 = faker.internet.email()

      const updatedName = faker.person.fullName()

      await prisma.user.createMany({
        data: [
          {
            email: email1,
          },
          {
            email: email2,
          },
          {
            email: email3,
          },
          {
            email: email4,
          },
        ],
      })

      const users = await prisma.user.updateManyAndReturn({
        data: {
          name: updatedName,
        },
        where: {
          email: {
            in: [email1, email2],
          },
        },
      })

      expect(users).toMatchObject([
        {
          email: email1,
          id: expect.any(String),
          name: updatedName,
        },
        {
          email: email2,
          id: expect.any(String),
          name: updatedName,
        },
      ])
    })

    test('should accept select', async () => {
      const email1 = faker.internet.email()
      const updatedName = faker.person.fullName()

      await prisma.user.create({
        data: {
          email: email1,
        },
      })

      const users = await prisma.user.updateManyAndReturn({
        select: { id: true },
        data: {
          name: updatedName,
        },
        where: {
          email: email1,
        },
      })

      expect(users).toMatchObject([
        {
          id: expect.any(String),
        },
      ])
    })

    test('should accept include on the post side', async () => {
      const email1 = faker.internet.email()

      const users = await prisma.user.createManyAndReturn({
        data: [
          {
            email: email1,
          },
        ],
      })

      await prisma.post.create({
        data: {
          userId: users[0].id,
          title: 'New post',
        },
      })

      const posts = await prisma.post.updateManyAndReturn({
        include: {
          user: true,
        },
        data: {
          title: 'Updated post',
        },
        where: {
          userId: users[0].id,
        },
      })

      expect(posts).toMatchObject([
        {
          id: expect.any(String),
          title: expect.any(String),
          userId: expect.any(String),
          user: {
            id: expect.any(String),
            email: email1,
          },
        },
      ])
    })

    test('should fail include on the user side', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          // @ts-expect-error
          include: {
            posts: true,
          },
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow('Unknown field `posts` for include statement on model `UpdateManyUserAndReturnOutputType`.')
    })

    test('take should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          // @ts-expect-error
          take: 1,
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow('Unknown argument `take`')
    })

    test('orderBy should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          // @ts-expect-error
          orderBy: {
            email: 'asc',
          },
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow('Unknown argument `orderBy`.')
    })

    test('distinct should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          // @ts-expect-error
          distinct: 'id',
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow('Unknown argument `distinct`.')
    })

    test('select _count should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          select: {
            // @ts-expect-error
            _count: true,
          },
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow(
        'Unknown field `_count` for select statement on model `UpdateManyUserAndReturnOutputType`. Available options are marked with ?.',
      )
    })

    test('include _count should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.updateManyAndReturn({
          // @ts-expect-error
          include: {
            _count: true,
          },
          data: {
            email: email1,
          },
        }),
      ).rejects.toThrow(
        'Unknown field `_count` for include statement on model `UpdateManyUserAndReturnOutputType`. Available options are marked with ?.',
      )
    })
  },
  {
    skipDriverAdapter: {
      from: ['js_d1'],
      reason:
        'D1 driver adapter does not return the correct number of created records. See https://github.com/prisma/team-orm/issues/1069',
    },
    optOut: {
      from: [Providers.MONGODB, Providers.SQLSERVER, Providers.MYSQL],
      reason: 'Excluded dbs are missing the "ConnectorCapability::InsertReturning". They are tested separately.',
    },
  },
)
