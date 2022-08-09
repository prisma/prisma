import { checkIfEmpty } from '../_utils/referential-integrity/checkIfEmpty'
import { ConditionalError } from '../_utils/referential-integrity/conditionalError'
import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'

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
    const conditionalError = ConditionalError.new()
      .with('provider', suiteConfig.provider)
      // @ts-ignore
      .with('referentialIntegrity', suiteConfig.referentialIntegrity || 'foreignKeys')

    const { onDelete, onUpdate } = suiteConfig
    const isMongoDB = suiteConfig.provider === Providers.MONGODB
    const isRI_prisma = isMongoDB || suiteConfig.referentialIntegrity === 'prisma'
    const isRI_foreignKeys = !isRI_prisma

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
        testIf(isRI_prisma)('RI=prisma [create] child with non existing parent should succeed', async () => {
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
        })
        testIf(isRI_foreignKeys)('RI=foreignKeys [create] child with non existing parent should throw', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: '1',
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

          expect(
            await prisma[profileModel].findMany({
              orderBy: [{ id: 'asc' }],
            }),
          ).toEqual([])
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

          expect(
            await prisma[profileModel].findMany({
              orderBy: [{ id: 'asc' }],
            }),
          ).toEqual([])
        })

        test('[create] nested child [create]', async () => {
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

        // Fails with `onUpdate: Restrict` & `referentialIntegrity = "prisma"`
        // On MongoDB / MySQL / Vitess (all providers?) fails with
        // The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.
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
        describeIf(!isMongoDB)('mutate id', () => {
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
            // foreignKeys
            testIf(isRI_foreignKeys)(
              'RI=foreignKeys - [update] parent id with non-existing id should throw',
              async () => {
                await expect(
                  prisma[userModel].update({
                    where: { id: '1' },
                    data: {
                      id: '3',
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
              },
            )
          })

          describeIf(['Restrict'].includes(onUpdate))('onUpdate: Restrict', () => {
            // prisma - Restrict
            testIf(isRI_prisma && onUpdate === 'Restrict')(
              'RI=prisma - Restrict - [update] parent id with non-existing id should throw',
              async () => {
                await expect(
                  prisma[userModel].update({
                    where: { id: '1' },
                    data: {
                      id: '3',
                    },
                  }),
                ).rejects.toThrowError(
                  conditionalError.snapshot({
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
              },
            )

            // prisma - Restrict
            testIf(isRI_prisma && onUpdate === 'Restrict')(
              'RI=prisma - Restrict - [updateMany] parent id with non-existing id should throw',
              async () => {
                await expect(
                  prisma[userModel].updateMany({
                    where: { id: '1' },
                    data: {
                      id: '3',
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
              },
            )
          })

          describeIf(['NoAction'].includes(onUpdate))('onUpdate: NoAction', () => {
            // prisma - NoAction
            testIf(isRI_prisma)(
              'RI=prisma - NoAction - [update] parent id with non-existing id should suceed',
              async () => {
                await prisma[userModel].update({
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
                    id: '2',
                    enabled: null,
                  },
                  {
                    id: '3',
                    enabled: null,
                  },
                ])
              },
            )

            // prisma - NoAction
            testIf(isRI_prisma)(
              'RI=prisma - NoAction - [updateMany] parent id with non-existing id should succeed',
              async () => {
                await prisma[userModel].updateMany({
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
                    id: '2',
                    enabled: null,
                  },
                  {
                    id: '3',
                    enabled: null,
                  },
                ])
              },
            )

            test('[updateMany] parent id with existing id should throw', async () => {
              await expect(
                prisma[userModel].updateMany({
                  data: { id: '2' }, // existing id
                  where: { id: '1' },
                }),
              ).rejects.toThrowError(
                conditionalError.snapshot({
                  foreignKeys: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
                    [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                  },
                  prisma: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    //  referential-integrity.tests_1-to-1 (provider=mysql, id=String @id, referentialIntegrity=prisma, referentialActions={onUpdateNoAction,onDeleteNoAction}, previewFeatures=referentialIntegrity) › 1:1 mandatory (explicit) › [update] › mutate id › onUpdate: NoAction › [updateMany] parent id with existing id should throw
                    [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
                    [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                  },
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

          describeIf(['DEFAULT', 'Restrict', 'SetNull'].includes(onUpdate))(
            'onUpdate: DEFAULT, Restrict, SetNull',
            () => {
              test('[update] parent id with existing id should throw', async () => {
                await expect(
                  prisma[userModel].update({
                    where: { id: '1' },
                    data: {
                      id: '2', // existing id
                    },
                  }),
                ).rejects.toThrowError(
                  conditionalError.snapshot({
                    foreignKeys: {
                      [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.MYSQL]:
                        onUpdate === 'Restrict'
                          ? // Restrict
                            'Foreign key constraint failed on the field: `userId`'
                          : // DEFAULT & SetNull
                            /*
                            Error occurred during query execution:
                            ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Server(ServerError { 
                              code: 1761,
                              message: \"Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone',
                              key 'ProfileOneToOne_userId_key'\",
                              state: \"23000\" })) })
                            */
                            `Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone`,
                      [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
                      [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                    },
                    prisma:
                      onUpdate === 'Restrict'
                        ? // Restrict
                          "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models."
                        : // DEFAULT & SetNull
                          {
                            [Providers.POSTGRESQL]:
                              onUpdate === 'SetNull'
                                ? // SetNull
                                  'Unique constraint failed on the fields: (`id`)'
                                : // DEFAULT
                                  'Unique constraint failed on the fields: (`userId`)',
                            [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`userId`)',
                            [Providers.MYSQL]:
                              'Unique constraint failed on the constraint: `ProfileOneToOne_userId_key`',
                            [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
                            [Providers.SQLITE]: 'Unique constraint failed on the fields: (`userId`)',
                          },
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

              test('[update] child id with existing id should throw', async () => {
                await expect(
                  prisma[profileModel].update({
                    where: { id: '1' },
                    data: {
                      id: '2', // existing id
                    },
                  }),
                ).rejects.toThrowError(
                  conditionalError.snapshot({
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

              test('[updateMany] parent id with existing id should throw', async () => {
                await expect(
                  prisma[userModel].updateMany({
                    data: { id: '2' }, // existing id
                    where: { id: '1' },
                  }),
                ).rejects.toThrowError(
                  conditionalError.snapshot({
                    foreignKeys: {
                      // SetNull
                      [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                      [Providers.MYSQL]:
                        onUpdate === 'Restrict'
                          ? // Restrict
                            'Foreign key constraint failed on the field: `userId`'
                          : // DEFAULT & SetNull
                            /*
                            Error occurred during query execution:
                            ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Server(ServerError { 
                              code: 1761, 
                              message: \"Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone',
                              key 'ProfileOneToOne_userId_key'\",
                              state: \"23000\" })) })"
                            */
                            `Foreign key constraint for table 'useronetoone', record '2' would lead to a duplicate entry in table 'profileonetoone`,
                      [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToOne`',
                      [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                    },
                    prisma:
                      onUpdate === 'Restrict'
                        ? // Restrict
                          "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models."
                        : // DEFAULT & SetNull
                          {
                            [Providers.POSTGRESQL]:
                              onUpdate === 'SetNull'
                                ? // SetNull
                                  'Unique constraint failed on the fields: (`id`)'
                                : // DEFAULT
                                  'Unique constraint failed on the fields: (`userId`)',
                            [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`userId`)',
                            [Providers.MYSQL]:
                              'Unique constraint failed on the constraint: `ProfileOneToOne_userId_key`',
                            [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.ProfileOneToOne`',
                            [Providers.SQLITE]: 'Unique constraint failed on the fields: (`userId`)',
                          },
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

          // describeIf(['Cascade'].includes(onUpdate))('onUpdate: Cascade', () => {
          //   test.skip('[update] parent id with existing id should succeed', async () => {})
          //   test.skip('[update] child id with existing id should succeed', async () => {})
          //   test.skip('[updateMany] parent id with existing id should', async () => {})
          //   test.skip('[update] nested child [disconnect] should succeed', async () => {})
          // })

          test('[update] nested child [connect] should succeed if the relationship already existed', async () => {
            await expect(
              prisma[userModel].update({
                where: { id: '1' },
                data: {
                  profile: {
                    connect: { id: '1' },
                  },
                },
              }),
            )
          })

          // This is ok for 1-to-n and m-to-m
          // test.skip('[update] nested child [updateMany] should succeed', async () => {})
          // test.skip('[update] nested child [upsert] child should succeed', async () => {})
          // test.skip('[upsert] parent id should succeed', async () => {})
          // test.skip('[upsert] parent id with existing id should throw', async () => {})
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

        describeIf(['DEFAULT', 'Restrict'].includes(onDelete))(`onDelete: 'DEFAULT', 'Restrict'`, () => {
          const expectedError = conditionalError.snapshot({
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
            ).rejects.toThrowError(expectedError)

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
            await expect(prisma[userModel].deleteMany()).rejects.toThrowError(expectedError)

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
        describeIf(['NoAction'].includes(onDelete))(`onDelete: 'NoAction'`, () => {
          const expectedError = conditionalError.snapshot({
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
          })
          // foreignKeys
          testIf(isRI_foreignKeys)('RI=foreignKeys - [delete] parent should throw', async () => {
            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(expectedError)

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
          testIf(isRI_foreignKeys)('RI=foreignKeys - [deleteMany] parents should throw', async () => {
            await expect(prisma[userModel].deleteMany()).rejects.toThrowError(expectedError)

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

          // prisma
          testIf(isRI_prisma)('RI=prisma - [delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
            }),
              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '2',
                  enabled: null,
                },
              ])
          })
          testIf(isRI_prisma)('RI=prisma - [deleteMany] parents should succeed', async () => {
            await prisma[userModel].deleteMany()

            expect(
              await prisma[userModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([])
          })
        })

        describeIf(['SetNull'].includes(onDelete))(`onDelete: SetNull`, () => {
          const expectedError = conditionalError.snapshot({
            foreignKeys: {
              [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.COCKROACHDB]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.MYSQL]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.SQLSERVER]: 'Null constraint violation on the fields: (`userId`)',
              [Providers.SQLITE]: 'Null constraint violation on the fields: (`userId`)',
            },
            prisma: 'Null constraint violation on the fields: (`userId`)',
          })

          test('[delete] parent should throw', async () => {
            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(expectedError)

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
            await expect(prisma[userModel].deleteMany()).rejects.toThrowError(expectedError)

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
