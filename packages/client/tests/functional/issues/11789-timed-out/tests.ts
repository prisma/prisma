import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Tests for:
 * - https://github.com/prisma/prisma/issues/11789
 * - https://github.com/prisma/prisma/issues/21772
 */
testMatrix.setupTestSuite(
  ({ provider }) => {
    async function createUsers(ids: string[]) {
      for (const id of ids) {
        await prisma.user.create({
          data: {
            id,
            email: `${id}@test.com`,
          },
        })
      }
    }

    async function createUsersConcurrently(ids: string[]) {
      return await Promise.all(
        ids.map((id) =>
          prisma.user.create({
            data: {
              id,
              email: `${id}@test.com`,
            },
          }),
        ),
      )
    }

    async function createProfilesConcurrently(ids: string[]) {
      return await Promise.all(
        ids.map((id) =>
          prisma.profile.create({
            data: {
              user: {
                connect: {
                  id,
                },
              },
            },
          }),
        ),
      )
    }

    function upsertProfilesConcurrently(ids: string[]) {
      return Promise.all(
        ids.map((id) =>
          prisma.profile.upsert({
            update: {},
            where: {
              id,
            },
            create: {
              user: {
                connect: {
                  id,
                },
              },
            },
          }),
        ),
      )
    }

    function deleteUsersConcurrently(ids: string[]) {
      return Promise.all(
        ids.map((id) =>
          prisma.user.delete({
            where: {
              id,
            },
          }),
        ),
      )
    }

    beforeEach(async () => {
      await prisma.profile.deleteMany()
      await prisma.user.deleteMany()
    })

    test('5 concurrent upsert should succeed', async () => {
      const N = 5
      const ids = Array.from({ length: N }, (_, i) => `${i + 1}`.padStart(5, '0'))
      await createUsers(ids)

      const queries = await upsertProfilesConcurrently(ids)

      expect(queries).toHaveLength(N)
    })

    test('5 concurrent delete should succeed', async () => {
      const N = 5
      const ids = Array.from({ length: N }, (_, i) => `${i + 1}`.padStart(5, '0'))
      await createUsers(ids)

      const queries = await deleteUsersConcurrently(ids)

      expect(queries).toHaveLength(N)
    })

    // Testing only on SQLite, to avoid overloading the CI with too many queries
    testIf([Providers.SQLITE].includes(provider))('100 concurrent creates should succeed', async () => {
      const N = 100
      const ids = Array.from({ length: N }).map((_, i) => `${i + 1}`.padStart(5, '0'))

      const users = await createUsersConcurrently(ids)
      expect(users).toHaveLength(N)

      const queries = await createProfilesConcurrently(ids)
      expect(queries).toHaveLength(N)
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mongodb', 'postgresql', 'cockroachdb', 'mysql'],
      reason: 'Test is made for SQLite only',
    },
  },
)
