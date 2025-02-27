import { faker } from '@faker-js/faker'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should create one record', async () => {
      const email1 = faker.internet.email()

      const users = await prisma.user.createManyAndReturn({
        data: {
          email: email1,
        },
      })

      expect(users).toMatchObject([
        {
          email: email1,
          id: expect.any(String),
          name: null,
        },
      ])
    })

    test('should create many records', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()
      const email3 = faker.internet.email()
      const email4 = faker.internet.email()

      const users = await prisma.user.createManyAndReturn({
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

      expect(users).toMatchObject([
        {
          email: email1,
          id: expect.any(String),
          name: null,
        },
        {
          email: email2,
          id: expect.any(String),
          name: null,
        },
        {
          email: email3,
          id: expect.any(String),
          name: null,
        },
        {
          email: email4,
          id: expect.any(String),
          name: null,
        },
      ])
    })

    test('should accept select', async () => {
      const email1 = faker.internet.email()

      const users = await prisma.user.createManyAndReturn({
        select: {
          id: true,
        },
        data: [
          {
            email: email1,
          },
        ],
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
        select: {
          id: true,
        },
        data: [
          {
            email: email1,
          },
        ],
      })

      const posts = await prisma.post.createManyAndReturn({
        include: {
          user: true,
        },
        data: [
          {
            userId: users[0].id,
            title: 'Include my user please!',
          },
        ],
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
        prisma.user.createManyAndReturn({
          // @ts-expect-error
          include: {
            posts: true,
          },
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow('Unknown field `posts` for include statement on model `CreateManyUserAndReturnOutputType`.')
    })

    test('take should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.createManyAndReturn({
          // @ts-expect-error
          take: 1,
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow('Unknown argument `take`')
    })

    test('orderBy should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.createManyAndReturn({
          // @ts-expect-error
          orderBy: {
            email: 'asc',
          },
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow('Unknown argument `orderBy`.')
    })

    test('distinct should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.createManyAndReturn({
          // @ts-expect-error
          distinct: 'id',
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow('Unknown argument `distinct`.')
    })

    test('select _count should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.createManyAndReturn({
          select: {
            // @ts-expect-error
            _count: true,
          },
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow(
        'Unknown field `_count` for select statement on model `CreateManyUserAndReturnOutputType`. Available options are marked with ?.',
      )
    })

    test('include _count should fail', async () => {
      const email1 = faker.internet.email()

      await expect(
        prisma.user.createManyAndReturn({
          // @ts-expect-error
          include: {
            _count: true,
          },
          data: [
            {
              email: email1,
            },
          ],
        }),
      ).rejects.toThrow(
        'Unknown field `_count` for include statement on model `CreateManyUserAndReturnOutputType`. Available options are marked with ?.',
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
