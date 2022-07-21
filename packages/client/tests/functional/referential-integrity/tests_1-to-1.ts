import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
import { checkIfEmpty } from './_utils'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// 1:1 relation
async function createXUsersWithAProfile({ count, userModel, profileModel, profileColumn }) {
  const prismaPromises: any = []

  for (let i = 0; i < count; i++) {
    // We want to start at 1
    const id = (i + 1).toString()
    const prismaPromise = prisma[userModel].create({
      data: {
        id: id,
        [profileColumn]: {
          create: { id: id },
        },
      },
      include: {
        [profileColumn]: true,
      },
    })
    prismaPromises.push(prismaPromise)
  }

  return await prisma.$transaction(prismaPromises)
}

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    function conditionalError(errors: Record<Providers, string>): string {
      return errors[suiteConfig.provider] || `TODO add error for ${suiteConfig.provider}`
    }
    const { onDelete } = suiteConfig.referentialActions
    const { onUpdate } = suiteConfig.referentialActions

    /**
     * 1:1 relation
     * - we can create a user without a profile, but not a profile without a user
     */

    describe('1:1 mandatory (explicit)', () => {
      const userModel = 'userOneToOne'
      const profileModel = 'profileOneToOne'
      const profileColumn = 'profile'

      beforeEach(async () => {
        await prisma.$transaction([prisma[profileModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      describe('[create]', () => {
        // TODO: this doesn't throw with "referentialIntegrity: prisma"
        test('[create] child with non existing parent should throw', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: '1',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
              [Providers.SQLSERVER]:
                'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
            }),
          )
        })

        test('[create] child with undefined parent should throw with type error', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: undefined, // this would actually be a type-error, but we don't have access to types here
              },
            }),
          ).rejects.toThrowError('Argument user for data.user is missing.')
        })

        test('[create] nested child [create]', async () => {
          const user1 = await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
            include: { profile: true },
          })
          expect(user1).toEqual({
            id: '1',
            profile: {
              id: '1',
              userId: '1',
            },
          })

          const profile1 = await prisma[profileModel].findUniqueOrThrow({
            where: { userId: '1' },
          })
          expect(profile1).toEqual({
            id: '1',
            userId: '1',
          })
          const user1Copy = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
          })
          expect(user1Copy).toEqual({
            id: '1',
          })
        })
      })

      describeIf(suiteConfig.provider !== Providers.MONGODB)('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, profileModel)
          await createXUsersWithAProfile({
            count: 2,
            userModel,
            profileModel,
            profileColumn,
          })
        })

        test('[upsert] child id with non-existing id should succeed', async () => {
          const profile1WithNewId = await prisma[profileModel].upsert({
            where: { id: '1' },
            create: {
              id: '3',
              userId: '1',
            },
            update: {
              id: '3',
            },
          })
          expect(profile1WithNewId).toEqual({
            id: '3',
            userId: '1',
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
            orderBy: { id: 'asc' },
          })
          expect(usersFromDb).toEqual([
            {
              id: '1',
              profile: {
                id: '3',
                userId: '1',
              },
            },
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profiles = await prisma[profileModel].findMany({
            orderBy: [{ id: 'asc' }],
          })
          expect(profiles).toEqual([
            {
              id: '2',
              userId: '2',
            },
            {
              id: '3',
              userId: '1',
            },
          ])
        })

        test('[update] child id with non-existing id should succeed', async () => {
          const profile1WithNewId = await prisma[profileModel].update({
            where: { id: '1' },
            data: {
              id: '3',
            },
          })
          expect(profile1WithNewId).toEqual({
            id: '3',
            userId: '1',
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
            orderBy: { id: 'asc' },
          })
          expect(usersFromDb).toEqual([
            {
              id: '1',
              profile: {
                id: '3',
                userId: '1',
              },
            },
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profiles = await prisma[profileModel].findMany({
            orderBy: [{ id: 'asc' }],
          })
          expect(profiles).toEqual([
            {
              id: '2',
              userId: '2',
            },
            {
              id: '3',
              userId: '1',
            },
          ])
        })

        test("[update] nested child [connect] child should succeed if the relationship didn't exist", async () => {
          await prisma[userModel].create({
            data: {
              id: '3',
            },
          })

          await prisma[userModel].update({
            where: { id: '3' },
            data: {
              profile: {
                connect: { id: '2' },
              },
            },
          })

          await expect(prisma[userModel].findMany({})).resolves.toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
            {
              id: '3',
            },
          ])
          await expect(prisma[profileModel].findMany({})).resolves.toEqual([
            {
              id: '1',
              userId: '1',
            },
            {
              id: '2',
              userId: '3',
            },
          ])
        })

        test('[update] nested child [update] should succeed', async () => {
          await prisma[userModel].update({
            where: { id: '1' },
            data: {
              profile: {
                update: {
                  id: '4',
                },
              },
            },
          })

          await expect(prisma[userModel].findMany({})).resolves.toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
          ])
          await expect(
            prisma[profileModel].findMany({
              // Needed for MySQL
              orderBy: [{ id: 'asc' }],
            }),
          ).resolves.toEqual([
            {
              id: '2',
              userId: '2',
            },
            {
              id: '4',
              userId: '1',
            },
          ])
        })

        describeIf(['DEFAULT', 'Cascade'].includes(onUpdate))('onUpdate: DEFAULT, Cascade', () => {
          test('[update] parent id with non-existing id should succeed', async () => {
            const user1WithNewId = await prisma[userModel].update({
              where: { id: '1' },
              data: {
                id: '3',
              },
            })
            expect(user1WithNewId).toEqual({
              id: '3',
            })

            // Checks
            const profileNull = await prisma[profileModel].findFirst({
              where: { userId: '1' },
            })
            expect(profileNull).toEqual(null)
            const profiles = await prisma[profileModel].findMany({
              orderBy: [{ id: 'asc' }],
            })
            expect(profiles).toEqual([
              {
                id: '1',
                userId: '3',
              },
              {
                id: '2',
                userId: '2',
              },
            ])
          })

          test('[updateMany] parent id should succeed', async () => {
            await prisma[userModel].updateMany({
              data: { id: '3' },
              where: { id: '1' },
            })

            await expect(
              prisma[userModel].findUnique({
                where: { id: '1' },
              }),
            ).resolves.toEqual(null)

            const user1WithNewId = await prisma[userModel].findUniqueOrThrow({
              where: { id: '3' },
              include: { profile: true },
            })
            expect(user1WithNewId).toEqual({
              id: '3',
              profile: {
                id: '1',
                userId: '3',
              },
            })

            const profile1FromUser3 = await prisma[profileModel].findUniqueOrThrow({
              where: { userId: '3' },
            })
            expect(profile1FromUser3).toEqual({
              id: '1',
              userId: '3',
            })
          })
        })

        describeIf(['Restrict', 'NoAction'].includes(onUpdate))('onUpdate: Restrict, NoAction', () => {
          test('[update] parent id with non-existing id should throw', async () => {
            await expect(
              prisma[userModel].update({
                where: { id: '1' },
                data: {
                  id: '3', // TODO: Type error, Invalid `prisma[userModel].update()` with Mongo.
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
              }),
            )
          })

          test('[updateMany] parent id with non-existing id should throw', async () => {
            await expect(
              prisma[userModel].updateMany({
                where: { id: '1' },
                data: {
                  id: '3',
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
              }),
            )
          })
        })

        describeIf(['NoAction'].includes(onUpdate))('onUpdate: NoAction', () => {
          test('[updateMany] parent id with existing id should throw', async () => {
            await expect(
              prisma[userModel].updateMany({
                data: { id: '2' }, // existing id
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.MYSQL]: "Foreign key constraint failed on the field: `userId`",
                [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
              }),
            )
          })
        })

        /*
        describeIf(['SetNull'].includes(onUpdate))('onUpdate: SetNull', () => {
          test('[update] parent id with existing id should succeed', async () => {
            await prisma[userModel].update({
              where: { id: '1' },
              data: {
                // TODO: Type error with MongoDB, Unknown arg `id` in data.id for type UserOneToOneUpdateInput.
                id: '2', // existing id
              },
            })
          })
        })
        */

        describeIf(['DEFAULT', 'Restrict', 'SetNull'].includes(onUpdate))('onUpdate: DEFAULT, Restrict, SetNull', () => {
          test('[update] parent id with existing id should throw', async () => {
            await expect(
              prisma[userModel].update({
                where: { id: '1' },
                data: {
                  id: '2', // existing id
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.MYSQL]:
                  "Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone', key 'ProfileOneToOne_userId_key'",
                [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
              }),
            )
          })

          test('[update] child id with existing id should throw', async () => {
            await expect(
              prisma[profileModel].update({
                where: { id: '1' },
                data: {
                  id: '2', // existing id
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
              }),
            )
          })

          test('[updateMany] parent id with existing id should throw', async () => {
            await expect(
              prisma[userModel].updateMany({
                data: { id: '2' }, // existing id
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                [Providers.MYSQL]:
                  "Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone', key 'ProfileOneToOne_userId_key'",
                [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
              }),
            )
          })

          test('[update] nested child [disconnect] should throw', async () => {
            await expect(
              prisma[userModel].update({
                where: { id: '1' },
                data: {
                  profile: {
                    disconnect: true,
                  },
                },
              }),
            ).rejects.toThrowError(
              "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
            )
          })
        })

        describeIf(['Cascade'].includes(onUpdate))('onUpdate: Cascade', () => {
          test.skip('[update] parent id with existing id should succeed', async () => {})
          test.skip('[update] child id with existing id should succeed', async () => {})
          test.skip('[updateMany] parent id with existing id should', async () => {})
          test.skip('[update] nested child [disconnect] should succeed', async () => {})
        })

        test.skip('[update] nested child [connect] should succeed if the relationship already existed', async () => {
          // TODO: this is probably a bug, this operation should be idempotent and succeed
          await expect(
            prisma[userModel].update({
              where: { id: '1' },
              data: {
                profile: {
                  connect: { id: '1' },
                },
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
              [Providers.COCKROACHDB]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
              [Providers.MYSQL]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
              [Providers.SQLSERVER]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
            }),
          )
        })

        // This is ok for 1-to-n and m-to-m
        test.skip('[update] nested child [updateMany] should succeed', async () => {})
        test.skip('[update] nested child [upsert] child should succeed', async () => {})
        test.skip('[upsert] parent id should succeed', async () => {})
        test.skip('[upsert] parent id with existing id should throw', async () => {})
      })

      describe('[delete]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, profileModel)
          await createXUsersWithAProfile({
            count: 2,
            userModel,
            profileModel,
            profileColumn,
          })
        })

        test('[delete] child should succeed', async () => {
          await prisma[profileModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '1',
              profile: null,
            },
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profilesFromDb = await prisma[profileModel].findMany({})
          expect(profilesFromDb).toEqual([
            {
              id: '2',
              userId: '2',
            },
          ])
        })

        test('[delete] child and then [delete] parent should succeed', async () => {
          await prisma[profileModel].delete({
            where: { id: '1' },
          })
          await prisma[userModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profilesFromDb = await prisma[profileModel].findMany({})
          expect(profilesFromDb).toEqual([
            {
              id: '2',
              userId: '2',
            },
          ])
        })

        describeIf(['DEFAULT', 'Restrict', 'NoAction'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          const expectedError = conditionalError({
            [Providers.MONGODB]:
              "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
            [Providers.POSTGRESQL]: 'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
            [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
            [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
            [Providers.SQLSERVER]: 'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
            [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
          })
          test('[delete] parent should throw', async () => {
            // this throws because "profileModel" has a mandatory relation with "userModel", hence
            // we have a "onDelete: Restrict" situation by default

            // MongoDB: onDelete: NoAction resolves with {"id": "1"}
            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(expectedError)
          })
          test('[deleteMany] parents should throw', async () => {
            await expect(prisma[userModel].deleteMany()).rejects.toThrowError(expectedError)
          })
        })
        describeIf(['SetNull'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          const expectedError =
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              // TODO: MongoDB: onDelete: SetNull resolves with {"id": "1"}
              // [Providers.MONGODB]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.COCKROACHDB]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.MYSQL]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.SQLSERVER]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.SQLITE]: 'Null constraint violation on the fields: (`userId`)',
            })
          test('[delete] parent should throw', async () => {
            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(expectedError)
          })
          test('[deleteMany] parents should throw', async () => {
            await expect(prisma[userModel].deleteMany()).rejects.toThrowError(expectedError)
          })
        })
        describeIf(['Cascade'].includes(onDelete))('onDelete: Cascade', () => {
          test('[delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
            })

            const usersFromDb = await prisma[userModel].findMany({
              include: { profile: true },
            })
            expect(usersFromDb).toEqual([
              {
                id: '2',
                profile: {
                  id: '2',
                  userId: '2',
                },
              },
            ])

            const profilesFromDb = await prisma[profileModel].findMany({})
            expect(profilesFromDb).toEqual([
              {
                id: '2',
                userId: '2',
              },
            ])
          })
        })
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver', 'mysql', 'postgresql'],
      reason: 'Only testing xyz provider(s) so opting out of xxx',
    },
  },
)
