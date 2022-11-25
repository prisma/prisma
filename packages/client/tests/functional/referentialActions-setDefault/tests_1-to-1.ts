import { Providers } from '../_utils/providers'
import { ConditionalError } from '../_utils/relationMode/conditionalError'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars, jest/no-identical-title */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

/**
 * 1:1 relation
 */
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const conditionalError = ConditionalError.new()
      .with('provider', suiteConfig.provider)
      .with('providerFlavor', suiteConfig.providerFlavor)
      // @ts-ignore
      .with('relationMode', 'foreignKeys' as const)

    describe('1:n mandatory (explicit)', () => {
      const userModel = 'userOneToOne'
      const profileModel = 'ProfileOneToOne'
      const { defaultUserId } = suiteConfig

      // - create user 1 with one profile having id 1
      // - create user 3 with no profile
      async function createTemplate() {
        // creating user id=1
        await prisma[userModel].create({
          data: { id: 1 },
        })

        // creating user id=${defaultUserId}
        await prisma[userModel].create({
          data: { id: defaultUserId },
        })

        // creating profile id=1, userId=1
        await prisma[profileModel].create({
          data: {
            id: 1,
            userId: 1,
          },
        })
      }

      beforeEach(async () => {
        await prisma.$transaction([prisma[profileModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      describe('[create]', () => {
        test('[create] creating a table with SetDefault is accepted', async () => {
          await createTemplate()

          const usersAndProfile = await prisma[userModel].findMany({
            include: {
              profile: true,
            },
            orderBy: { id: 'asc' },
          })
          expect(usersAndProfile).toMatchObject([
            {
              id: 1,
              profile: {
                id: 1,
                userId: 1,
              },
            },
            {
              id: defaultUserId,
              profile: null,
            },
          ])
        })
      })

      describe('[update]', () => {
        describeIf([Providers.MYSQL].includes(suiteConfig.provider))('with mysql', () => {
          test('[update] changing existing user id to a new one triggers NoAction under the hood', async () => {
            await createTemplate()

            await expect(
              prisma[userModel].update({
                where: { id: 1 },
                data: {
                  id: 2,
                },
              }),
            ).rejects.toThrowError(
              conditionalError.snapshot({
                foreignKeys: {
                  [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                },
              }),
            )
          })
        })

        describeIf(![Providers.MYSQL].includes(suiteConfig.provider))('without mysql', () => {
          test('[update] changing existing user id to a new one triggers SetDefault', async () => {
            await createTemplate()

            await prisma[userModel].update({
              where: { id: 1 },
              data: {
                id: 2,
              },
            })

            const users = await prisma[userModel].findMany({
              orderBy: { id: 'asc' },
            })

            expect(users).toMatchObject([{ id: 2 }, { id: defaultUserId }])

            const profile = await prisma[profileModel].findMany({
              orderBy: { id: 'asc' },
            })

            expect(profile).toMatchObject([
              {
                id: 1,
                userId: defaultUserId,
              },
            ])
          })
        })

        test('[update] removing user with default id and changing existing user id to a new one triggers SetDefault in profile, which throws', async () => {
          await createTemplate()

          await prisma[userModel].delete({
            where: { id: defaultUserId },
          })

          // profileModel cannot fall back to { userId: defaultUserId }, as no user with that id exists
          await expect(
            prisma[userModel].update({
              where: { id: 1 },
              data: {
                id: 2,
              },
            }),
          ).rejects.toThrowError(
            conditionalError.snapshot({
              foreignKeys: {
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
              },
            }),
          )
        })
      })

      describe('[delete]', () => {
        describeIf([Providers.MYSQL].includes(suiteConfig.provider))('with mysql', () => {
          test('[delete] changing existing user id to a new one triggers NoAction under the hood', async () => {
            await createTemplate()

            await expect(
              prisma[userModel].delete({
                where: { id: 1 },
              }),
            ).rejects.toThrowError(
              conditionalError.snapshot({
                foreignKeys: {
                  [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                },
              }),
            )
          })
        })

        describeIf(![Providers.MYSQL].includes(suiteConfig.provider))('without mysql', () => {
          test('[delete] deleting existing user one triggers SetDefault', async () => {
            await createTemplate()

            await prisma[userModel].delete({
              where: { id: 1 },
            })

            const users = await prisma[userModel].findMany({
              orderBy: { id: 'asc' },
            })

            expect(users).toMatchObject([{ id: defaultUserId }])

            const profile = await prisma[profileModel].findMany({
              include: { user: true },
              orderBy: { id: 'asc' },
            })

            expect(profile).toMatchObject([
              {
                id: 1,
                userId: defaultUserId,
              },
            ])
          })
        })

        test('[delete] removing user with default id and changing existing user id to a new one triggers SetDefault in profile, which throws', async () => {
          await createTemplate()

          await prisma[userModel].delete({
            where: { id: defaultUserId },
          })

          // profileModel cannot fall back to { userId: defaultUserId }, as no user with that id exists
          await expect(
            prisma[userModel].delete({
              where: { id: 1 },
            }),
          ).rejects.toThrowError(
            conditionalError.snapshot({
              foreignKeys: {
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
              },
            }),
          )
        })
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Only testing relational databases using foreign keys.',
    },
  },
)
