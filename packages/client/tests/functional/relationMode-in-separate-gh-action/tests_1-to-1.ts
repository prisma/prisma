import { Providers } from '../_utils/providers'
import { checkIfEmpty } from '../_utils/relationMode/checkIfEmpty'
import { ConditionalError } from '../_utils/relationMode/conditionalError'
import { ProviderFlavors } from '../_utils/relationMode/ProviderFlavor'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars, jest/no-identical-title */

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
    const conditionalError = ConditionalError.new()
      .with('provider', suiteConfig.provider)
      .with('providerFlavor', suiteConfig.providerFlavor)
      // @ts-ignore
      .with('relationMode', suiteConfig.relationMode || 'foreignKeys')

    const onUpdate = suiteConfig.onUpdate
    const onDelete = suiteConfig.onDelete
    // @ts-expect-error
    const isMongoDB = suiteConfig.provider === Providers.MONGODB
    const isRelationMode_prisma = isMongoDB || suiteConfig.relationMode === 'prisma'
    const isRelationMode_foreignKeys = !isRelationMode_prisma
    const isSchemaUsingMap = suiteConfig.isSchemaUsingMap

    // Looking at CI results
    // 30s was often not enough for vitess
    // so we put it back to 60s for now in this case
    if (suiteConfig.providerFlavor === ProviderFlavors.VITESS_8) {
      jest.setTimeout(60_000)
    }

    /**
     * 1:1 relation
     * - we can create a user without a profile, but not a profile without a user
     */
    describe('1:1 mandatory (explicit)', () => {
      const userModel = 'userOneToOne'
      const profileModel = 'profileOneToOne'
      const profileOptionalModel = 'profileOptionalOneToOne'
      const profileColumn = 'profile'
      const profileOptionalColumn = 'profileOptional'

      beforeEach(async () => {
        await prisma.$transaction([
          prisma[profileModel].deleteMany(),
          prisma[profileOptionalModel].deleteMany(),
          prisma[userModel].deleteMany(),
        ])
      })

      describe('[create]', () => {
        testIf(isRelationMode_prisma)(
          'relationMode=prisma [create] child with non existing parent should succeed',
          async () => {
            await prisma[profileModel].create({
              data: {
                id: '1',
                userId: '1',
              },
            })

            expect(
              await prisma[profileModel].findMany({
                orderBy: [{ id: 'asc' }],
              }),
            ).toEqual([
              {
                id: '1',
                userId: '1',
                enabled: null,
              },
            ])
          },
        )
        testIf(isRelationMode_foreignKeys)(
          'relationMode=foreignKeys [create] child with non existing parent should throw',
          async () => {
            await expect(
              prisma[profileModel].create({
                data: {
                  id: '1',
                  userId: '1',
                },
              }),
            ).rejects.toThrow(
              isSchemaUsingMap && isRelationMode_foreignKeys
                ? // The snapshot changes when using @@map/@map, though only the name of the table/field is different
                  // So we can be less specific here
                  `Foreign key constraint failed on the field:`
                : conditionalError.snapshot({
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

            expect(
              await prisma[profileModel].findMany({
                orderBy: [{ id: 'asc' }],
              }),
            ).toEqual([])
          },
        )

        test('[create] child with undefined parent should throw with type error', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                // @ts-expect-error
                userId: undefined, // this would actually be a type-error, but we don't have access to types here
              },
            }),
          ).rejects.toThrow('Argument user for data.user is missing.')

          expect(
            await prisma[profileModel].findMany({
              orderBy: [{ id: 'asc' }],
            }),
          ).toEqual([])
        })

        test('[create] nested child [create] should succeed', async () => {
          await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
          })

          expect(
            await prisma[userModel].findUniqueOrThrow({
              where: { id: '1' },
            }),
          ).toEqual({
            id: '1',
            enabled: null,
          })
          expect(
            await prisma[profileModel].findUniqueOrThrow({
              where: { userId: '1' },
            }),
          ).toEqual({
            id: '1',
            userId: '1',
            enabled: null,
          })
        })
      })

      describe('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, profileModel)
          await createXUsersWithAProfile({
            count: 2,
            userModel,
            profileModel,
            profileColumn,
          })
        })

        test('[update] (user) optional boolean field should succeed', async () => {
          await prisma[userModel].update({
            where: { id: '1' },
            data: {
              enabled: true,
            },
          })

          expect(
            await prisma[userModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            // The update
            { id: '1', enabled: true },
            { id: '2', enabled: null },
          ])
          expect(
            await prisma[profileModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              userId: '1',
              enabled: null,
            },
            { id: '2', userId: '2', enabled: null },
          ])
        })

        test('[update] (profile) optional boolean field should succeed', async () => {
          await prisma[profileModel].update({
            where: { id: '1' },
            data: {
              enabled: true,
            },
          })

          expect(
            await prisma[userModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            { id: '1', enabled: null },
            { id: '2', enabled: null },
          ])
          expect(
            await prisma[profileModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1',
              userId: '1',
              // the update
              enabled: true,
            },
            { id: '2', userId: '2', enabled: null },
          ])
        })

        // Not possible on MongoDB as _id is immutable
        describeIf(!isMongoDB)('mutate id tests (skipped only for MongoDB)', () => {
          test('[upsert] child id with non-existing id should succeed', async () => {
            await prisma[profileModel].upsert({
              where: { id: '1' },
              create: {
                id: '3',
                userId: '1',
              },
              update: {
                id: '3',
              },
            })

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])
            expect(
              await prisma[profileModel].findMany({
                orderBy: [{ id: 'asc' }],
              }),
            ).toEqual([
              {
                id: '2',
                userId: '2',
                enabled: null,
              },
              {
                id: '3',
                userId: '1',
                enabled: null,
              },
            ])
          })

          test('[update] child id with non-existing id should succeed', async () => {
            await prisma[profileModel].update({
              where: { id: '1' },
              data: {
                id: '3',
              },
            })

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])
            expect(
              await prisma[profileModel].findMany({
                orderBy: [{ id: 'asc' }],
              }),
            ).toEqual([
              {
                id: '2',
                userId: '2',
                enabled: null,
              },
              {
                id: '3',
                userId: '1',
                enabled: null,
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

            await expect(prisma[userModel].findMany()).resolves.toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
              {
                id: '3',
                enabled: null,
              },
            ])
            await expect(prisma[profileModel].findMany()).resolves.toEqual([
              {
                id: '1',
                userId: '1',
                enabled: null,
              },
              {
                id: '2',
                userId: '3',
                enabled: null,
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

            await expect(prisma[userModel].findMany()).resolves.toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])
            await expect(
              prisma[profileModel].findMany({
                orderBy: [{ id: 'asc' }],
              }),
            ).resolves.toEqual([
              {
                id: '2',
                userId: '2',
                enabled: null,
              },
              {
                id: '4',
                userId: '1',
                enabled: null,
              },
            ])
          })

          describeIf(['DEFAULT', 'Cascade'].includes(onUpdate))('onUpdate: DEFAULT, Cascade', () => {
            test('[update] parent id with non-existing id should succeed', async () => {
              await prisma[userModel].update({
                where: { id: '1' },
                data: {
                  id: '3',
                },
              })

              await expect(prisma[userModel].findMany({ orderBy: [{ id: 'asc' }] })).resolves.toEqual([
                {
                  id: '2',
                  enabled: null,
                },
                {
                  id: '3',
                  enabled: null,
                },
              ])
              expect(
                await prisma[profileModel].findMany({
                  orderBy: [{ id: 'asc' }],
                }),
              ).toEqual([
                {
                  id: '1',
                  userId: '3',
                  enabled: null,
                },
                {
                  id: '2',
                  userId: '2',
                  enabled: null,
                },
              ])
            })

            test('[updateMany] parent id should succeed', async () => {
              await prisma[userModel].updateMany({
                where: { id: '1' },
                data: { id: '3' },
              })

              await expect(
                prisma[userModel].findUnique({
                  where: { id: '1' },
                }),
              ).resolves.toEqual(null)

              const user1WithNewId = await prisma[userModel].findUniqueOrThrow({
                where: { id: '3' },
              })
              expect(user1WithNewId).toEqual({
                id: '3',
                enabled: null,
              })
              const profile1FromUser3 = await prisma[profileModel].findUniqueOrThrow({
                where: { userId: '3' },
              })
              expect(profile1FromUser3).toEqual({
                id: '1',
                userId: '3',
                enabled: null,
              })
            })
          })

          describeIf(['Restrict', 'NoAction'].includes(onUpdate))('onUpdate: Restrict, NoAction', () => {
            const expectedErrorUpdateWithNonExistingId =
              isSchemaUsingMap && isRelationMode_foreignKeys
                ? // The snapshot changes when using @map/@@map, though only the name of the table/field is different
                  // So we can be less specific here
                  `Foreign key constraint failed on the field:`
                : conditionalError.snapshot({
                    foreignKeys: {
                      [Providers.POSTGRESQL]:
                        'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                      [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                      [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                      [Providers.SQLSERVER]:
                        'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                      [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
                    },
                    prisma:
                      "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
                  })

            test('[update] parent id with non-existing id should throw', async () => {
              await expect(
                prisma[userModel].update({
                  where: { id: '1' },
                  data: {
                    id: '3',
                  },
                }),
              ).rejects.toThrow(expectedErrorUpdateWithNonExistingId)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            })

            test('[updateMany] parent id with non-existing id should throw', async () => {
              await expect(
                prisma[userModel].updateMany({
                  where: { id: '1' },
                  data: {
                    id: '3',
                  },
                }),
              ).rejects.toThrow(expectedErrorUpdateWithNonExistingId)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            })
          })

          // Note: The test suite does not test `SetNull` with providers that errors during migration
          // see _utils/relationMode/computeMatrix.ts
          describeIf(['DEFAULT', 'Restrict', 'NoAction', 'SetNull'].includes(onUpdate))(
            'onUpdate: DEFAULT, Restrict, NoAction, SetNull',
            () => {
              const expectedErrorUpdateWithExistingId = isSchemaUsingMap // The snapshot changes when using @@map/@map, though only the name of the table/field is different
                ? // So we can ignore the error message
                  undefined
                : conditionalError.snapshot({
                    // Note: The test suite does not test `SetNull` with providers that errors during migration
                    // see _utils/relationMode/computeMatrix.ts
                    foreignKeys: {
                      [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.MYSQL]: ['Restrict', 'NoAction'].includes(onUpdate)
                        ? // Restrict / NoAction
                          'Foreign key constraint failed on the field: `userId`'
                        : // DEFAULT / SetNull
                          /*
                      Error occurred during query execution:
                      ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Server(ServerError { 
                        code: 1761,
                        message: \"Foreign key constraint for table 'UserOneToOne', record '2' would lead to a duplicate entry in table 'ProfileOneToOne',
                        key 'ProfileOneToOne_userId_key'\",
                        state: \"23000\" })) })
                      */
                          // Note: in CI we run with --lower_case_table_names=1
                          `Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone'`,
                      [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
                      [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                    },
                    prisma: ['Restrict', 'NoAction'].includes(onUpdate)
                      ? // Restrict / NoAction
                        "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models."
                      : // DEFAULT / SetNull
                        {
                          [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`userId`)',
                          [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`userId`)',
                          [Providers.MYSQL]: 'Unique constraint failed on the constraint: `ProfileOneToOne_userId_key`',
                          [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
                          [Providers.SQLITE]: 'Unique constraint failed on the fields: (`userId`)',
                          [ProviderFlavors.VITESS_8]: 'Unique constraint failed on the (not available)',
                        },
                  })

              test('[update] parent id with existing id should throw', async () => {
                await expect(
                  prisma[userModel].update({
                    where: { id: '1' },
                    data: {
                      id: '2', // existing id
                    },
                  }),
                ).rejects.toThrow(expectedErrorUpdateWithExistingId)

                expect(
                  await prisma[userModel].findMany({
                    orderBy: { id: 'asc' },
                  }),
                ).toEqual([
                  {
                    id: '1',
                    enabled: null,
                  },
                  {
                    id: '2',
                    enabled: null,
                  },
                ])
              })

              test('[updateMany] parent id with existing id should throw', async () => {
                await expect(
                  prisma[userModel].updateMany({
                    where: { id: '1' },
                    data: { id: '2' }, // existing id
                  }),
                ).rejects.toThrow(expectedErrorUpdateWithExistingId)

                expect(
                  await prisma[userModel].findMany({
                    orderBy: { id: 'asc' },
                  }),
                ).toEqual([
                  {
                    id: '1',
                    enabled: null,
                  },
                  {
                    id: '2',
                    enabled: null,
                  },
                ])
              })

              test('[update] child id with existing id should throw', async () => {
                await expect(
                  prisma[profileModel].update({
                    where: { id: '1' },
                    data: {
                      id: '2', // existing id
                    },
                  }),
                ).rejects.toThrow(
                  isSchemaUsingMap
                    ? // The snapshot changes when using @@map/@map, though only the name of the table/field is different
                      // So we can be less specific here
                      `Unique constraint failed on the`
                    : conditionalError.snapshot({
                        foreignKeys: {
                          [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                          [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                          [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                          [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
                          [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                        },
                        prisma: {
                          [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                          [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                          [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                          [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
                          [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                          [ProviderFlavors.VITESS_8]: 'Unique constraint failed on the (not available)',
                        },
                      }),
                )

                expect(
                  await prisma[profileModel].findMany({
                    orderBy: [{ id: 'asc' }],
                  }),
                ).toEqual([
                  {
                    id: '1',
                    userId: '1',
                    enabled: null,
                  },
                  {
                    id: '2',
                    userId: '2',
                    enabled: null,
                  },
                ])
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
                ).rejects.toThrow(
                  conditionalError.snapshot({
                    foreignKeys:
                      "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
                    prisma:
                      "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
                  }),
                )

                expect(
                  await prisma[userModel].findMany({
                    orderBy: { id: 'asc' },
                  }),
                ).toEqual([
                  {
                    id: '1',
                    enabled: null,
                  },
                  {
                    id: '2',
                    enabled: null,
                  },
                ])
              })
            },
          )

          test('[update] nested child [connect] should succeed if the relationship already existed', async () => {
            await prisma[userModel].update({
              where: { id: '1' },
              data: {
                profile: {
                  connect: { id: '1' },
                },
              },
            })

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])

            expect(
              await prisma[profileModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
                userId: '1',
              },
              {
                id: '2',
                enabled: null,
                userId: '2',
              },
            ])
          })
        })
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

          expect(
            await prisma[userModel].findMany({
              include: { profile: true },
            }),
          ).toEqual([
            {
              id: '1',
              enabled: null,
              // The change
              profile: null,
            },
            {
              id: '2',
              enabled: null,
              profile: {
                id: '2',
                userId: '2',
                enabled: null,
              },
            },
          ])
          expect(await prisma[profileModel].findMany()).toEqual([
            {
              id: '2',
              userId: '2',
              enabled: null,
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

          expect(await prisma[userModel].findMany()).toEqual([
            {
              id: '2',
              enabled: null,
            },
          ])
          expect(await prisma[profileModel].findMany()).toEqual([
            {
              id: '2',
              userId: '2',
              enabled: null,
            },
          ])
        })

        describeIf(['DEFAULT', 'Restrict', 'NoAction'].includes(onDelete))(
          `onDelete: DEFAULT, Restrict, NoAction`,
          () => {
            const expectedError =
              isSchemaUsingMap && isRelationMode_foreignKeys
                ? // The snapshot changes when using @@map/@map, though only the name of the table/field is different
                  // So we can be less specific here
                  `Foreign key constraint failed on the field:`
                : conditionalError.snapshot({
                    foreignKeys: {
                      [Providers.MONGODB]:
                        "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
                      [Providers.POSTGRESQL]:
                        'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                      [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                      [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                      [Providers.SQLSERVER]:
                        'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                      [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
                    },
                    prisma:
                      "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
                  })

            test('[delete] parent should throw', async () => {
              // this throws because "profileModel" has a mandatory relation with "userModel", hence
              // we have a "onDelete: Restrict" situation by default
              await expect(
                prisma[userModel].delete({
                  where: { id: '1' },
                }),
              ).rejects.toThrow(expectedError)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            })
            test('[deleteMany] parents should throw', async () => {
              await expect(prisma[userModel].deleteMany()).rejects.toThrow(expectedError)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            })
          },
        )

        describeIf(['SetNull'].includes(onDelete))(`onDelete: SetNull`, () => {
          const expectedError =
            isSchemaUsingMap && isRelationMode_foreignKeys
              ? // The snaphsot changes when using @map/@@map, though only the name of the table/field is different
                // So we can be less specific here
                `Foreign key constraint failed on the field:`
              : conditionalError.snapshot({
                  foreignKeys: {
                    [Providers.POSTGRESQL]:
                      'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                    [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                    [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                    [Providers.SQLSERVER]:
                      'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                    [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
                  },
                  prisma: 'It does not error. see https://github.com/prisma/prisma/issues/15683 ',
                })

          testIf(isRelationMode_foreignKeys)('[delete] parent should throw', async () => {
            await expect(prisma[userModel].delete({ where: { id: '1' } })).rejects.toThrow(expectedError)

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])
          })
          testIf(isRelationMode_foreignKeys)('[deleteMany] parents should throw', async () => {
            await expect(prisma[userModel].deleteMany()).rejects.toThrow(expectedError)

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                enabled: null,
              },
              {
                id: '2',
                enabled: null,
              },
            ])
          })

          // For all databases (PostgreSQL, SQLite, MySQL, SQL Server, CockroachDB & MongoDB)
          // onDelete: SetNull & relationMode: prisma
          // fails the 2 following tests
          // they are a copy above the tests above but with relationMode: prisma and `.failing`
          // So we can run all the tests successfully
          //
          // For the first test `[delete] parent should throw`:
          // Received promise resolved instead of rejected
          // Resolved to value: {"enabled": null, "id": "1"}
          //
          // For the second test `[deleteMany] parents should throw`:
          // Received promise resolved instead of rejected
          // Resolved to value: {"count": 2}
          //
          // See issue https://github.com/prisma/prisma/issues/15683

          testIf(isRelationMode_prisma).failing(
            'relationMode=prisma / SetNull: [delete] parent should throw',
            async () => {
              await expect(
                prisma[userModel].delete({
                  where: { id: '1' },
                }),
              ).rejects.toThrow(expectedError)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            },
          )
          testIf(isRelationMode_prisma).failing(
            'relationMode=prisma / SetNull: [deleteMany] parents should throw',
            async () => {
              await expect(prisma[userModel].deleteMany()).rejects.toThrow(expectedError)

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1',
                  enabled: null,
                },
                {
                  id: '2',
                  enabled: null,
                },
              ])
            },
          )
        })

        describeIf(['Cascade'].includes(onDelete))('onDelete: Cascade', () => {
          test('[delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
            })

            expect(await prisma[userModel].findMany()).toEqual([
              {
                id: '2',
                enabled: null,
              },
            ])
            expect(await prisma[profileModel].findMany()).toEqual([
              {
                id: '2',
                userId: '2',
                enabled: null,
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
