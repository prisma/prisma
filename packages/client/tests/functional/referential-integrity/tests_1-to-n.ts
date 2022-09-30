import { checkIfEmpty } from '../_utils/referential-integrity/checkIfEmpty'
import { ConditionalError } from '../_utils/referential-integrity/conditionalError'
import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// 1:n relation
async function createXUsersWith2Posts({ count, userModel, postModel, postColumn }) {
  const prismaPromises = [] as Array<Promise<any>>

  for (let i = 1; i <= count; i++) {
    const id = i.toString()

    prismaPromises.push(
      prisma[userModel].create({
        data: {
          id,
        },
      }),
    )

    prismaPromises.push(
      prisma[postModel].create({
        data: {
          id: `${id}-post-a`,
          authorId: id,
        },
      }),
    )

    prismaPromises.push(
      prisma[postModel].create({
        data: {
          id: `${id}-post-b`,
          authorId: id,
        },
      }),
    )

    /*
    const prismaPromise = prisma[userModel].create({
      data: {
        id,
        [postColumn]: {
          createMany: {
            data: [{ id: `${id}-post-a` }, { id: `${id}-post-b` }],
          },
        },
      },
      include: {
        [postColumn]: true,
      },
    })

    prismaPromises.push(prismaPromise)
    */
  }

  return await prisma.$transaction(prismaPromises)
}

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const conditionalError = ConditionalError.new()
      .with('provider', suiteConfig.provider)
      // @ts-ignore
      .with('referentialIntegrity', suiteConfig.referentialIntegrity || 'foreignKeys')

    const onUpdate = suiteConfig.onUpdate
    const onDelete = suiteConfig.onDelete
    const isMongoDB = suiteConfig.provider === Providers.MONGODB
    const isPostgreSQL = suiteConfig.provider === Providers.POSTGRESQL
    const isSQLite = suiteConfig.provider === Providers.SQLITE
    const isRI_prisma = isMongoDB || suiteConfig.referentialIntegrity === 'prisma'
    const isRI_foreignKeys = !isRI_prisma

    /**
     * 1:n relationship
     */

    describe('1:n mandatory (explicit)', () => {
      const userModel = 'userOneToMany'
      const postModel = 'postOneToMany'
      const postColumn = 'posts'

      beforeEach(async () => {
        await prisma.$transaction([prisma[postModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      afterEach(async () => {
        await prisma.$disconnect()
      })

      describe('[create]', () => {
        testIf(isRI_prisma)(
          'RI=prisma - [create] categoriesOnPostsModel with non-existing post and category id should suceed with prisma emulation',
          async () => {
            await prisma[postModel].create({
              data: {
                id: '1',
                authorId: '1',
              },
            })

            expect(
              await prisma[postModel].findMany({
                where: { authorId: '1' },
              }),
            ).toEqual([
              {
                id: '1',
                authorId: '1',
              },
            ])
          },
        )
        testIf(isRI_foreignKeys)('RI=foreignKeys [create] child with non existing parent should throw', async () => {
          await expect(
            prisma[postModel].create({
              data: {
                id: '1',
                authorId: '1',
              },
            }),
          ).rejects.toThrowError(
            conditionalError.snapshot({
              foreignKeys: {
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
                [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
              },
            }),
          )

          expect(
            await prisma[postModel].findMany({
              where: { authorId: '1' },
            }),
          ).toEqual([])
        })

        test('[create] child with undefined parent should throw with type error', async () => {
          await expect(
            prisma[postModel].create({
              data: {
                id: '1',
                authorId: undefined, // this would actually be a type-error, but we don't have access to types here
              },
            }),
          ).rejects.toThrowError('Argument author for data.author is missing.')
        })

        test('[create] nested child [create]', async () => {
          await prisma[userModel].create({
            data: {
              id: '1',
              posts: {
                create: { id: '1' },
              },
            },
            include: { posts: true },
          })

          expect(
            await prisma[postModel].findMany({
              where: { authorId: '1' },
            }),
          ).toEqual([
            {
              id: '1',
              authorId: '1',
            },
          ])
          expect(
            await prisma[userModel].findUniqueOrThrow({
              where: { id: '1' },
            }),
          ).toEqual({
            id: '1',
            enabled: null,
          })
        })

        describeIf(![Providers.SQLITE].includes(suiteConfig.provider))('not sqlite', () => {
          // SQLite doesn't support createMany
          test('[create] nested child [createMany]', async () => {
            await prisma[userModel].create({
              data: {
                id: '1',
                posts: {
                  createMany: {
                    data: [{ id: '1' }, { id: '2' }],
                  },
                },
              },
              include: { posts: true },
            })

            expect(
              await prisma[postModel].findMany({
                where: { authorId: '1' },
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1',
                authorId: '1',
              },
              {
                id: '2',
                authorId: '1',
              },
            ])
            expect(
              await prisma[userModel].findUniqueOrThrow({
                where: { id: '1' },
              }),
            ).toEqual({
              id: '1',
              enabled: null,
            })
          })
        })
      })

      describe('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, postModel)
          await createXUsersWith2Posts({
            count: 2,
            userModel,
            postModel,
            postColumn,
          })
        })

        // Fails with `onUpdate: Restrict` & `referentialIntegrity = "prisma"`
        // On MongoDB / MySQL / Vitess (all providers?) fails with
        // The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.
        test('[update] optional boolean field should succeed', async () => {
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
            { id: '1', enabled: true },
            { id: '2', enabled: null },
          ])
          expect(
            await prisma[postModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1-post-a',
              authorId: '1',
            },
            {
              id: '1-post-b',
              authorId: '1',
            },
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        // Not possible on MongoDB as _id is immutable
        describeIf(!isMongoDB)('mutate id tests (skipped only for MongoDB)', () => {
          describeIf(['DEFAULT', 'CASCADE'].includes(onUpdate))('onUpdate: DEFAULT, CASCADE', () => {
            test('[update] parent id with non-existing id should succeed', async () => {
              await prisma[userModel].update({
                where: { id: '1' },
                data: {
                  id: '3',
                },
                include: { posts: true },
              })

              expect(
                await prisma[userModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                { id: '2', enabled: null },
                { id: '3', enabled: null },
              ])
              expect(
                await prisma[postModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '1-post-a',
                  authorId: '3',
                },
                {
                  id: '1-post-b',
                  authorId: '3',
                },
                {
                  id: '2-post-a',
                  authorId: '2',
                },
                {
                  id: '2-post-b',
                  authorId: '2',
                },
              ])
            })
          })

          describeIf(['NoAction'].includes(onUpdate))('onUpdate: NoAction', () => {
            test('[update] parent id with existing id should throw', async () => {
              await expect(
                prisma[userModel].update({
                  where: { id: '1' },
                  data: {
                    id: '2',
                  },
                }),
              ).rejects.toThrowError(
                conditionalError.snapshot({
                  foreignKeys: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToMany`',
                    [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                  },
                  prisma: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToMany`',
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

          describeIf(['DEFAULT, Cascade'].includes(onUpdate))('onUpdate: DEFAULT, Cascade', () => {
            test('[update] parent id with existing id should throw', async () => {
              await expect(
                prisma[userModel].update({
                  where: { id: '1' },
                  data: {
                    id: '2',
                  },
                }),
              ).rejects.toThrowError(
                conditionalError.snapshot({
                  foreignKeys: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToMany`',
                  },
                  prisma: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToMany`',
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

          describeIf(['DEFAULT', 'Cascade', 'Restrict'].includes(onUpdate))(
            'onUpdate: Default, Cascade, Restrict',
            () => {
              test('[update] child id with non-existing id should succeed', async () => {
                await prisma[postModel].update({
                  where: { id: '1-post-a' },
                  data: {
                    id: '1-post-c',
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
                  await prisma[postModel].findMany({
                    orderBy: { id: 'asc' },
                  }),
                ).toEqual([
                  {
                    id: '1-post-b',
                    authorId: '1',
                  },
                  {
                    id: '1-post-c',
                    authorId: '1',
                  },
                  {
                    id: '2-post-a',
                    authorId: '2',
                  },
                  {
                    id: '2-post-b',
                    authorId: '2',
                  },
                ])
              })
            },
          )

          describeIf(['Restrict'].includes(onUpdate))('onUpdate: Restrict', () => {
            test('[update] parent id with existing id should throw', async () => {
              await expect(
                prisma[userModel].update({
                  where: { id: '1' },
                  data: {
                    id: '2',
                  },
                }),
              ).rejects.toThrowError(
                conditionalError.snapshot({
                  foreignKeys: {
                    [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
                    [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
                    [Providers.SQLSERVER]: 'Unique constraint failed on the constraint: `dbo.UserOneToMany`',
                    [Providers.SQLITE]: 'Unique constraint failed on the fields: (`id`)',
                  },
                  prisma:
                    "The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.",
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

          test('[update] child id with non-existing id should succeed', async () => {
            await prisma[postModel].update({
              where: { id: '1-post-a' },
              data: {
                id: '1-post-c',
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
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '1-post-c',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])
          })
        })
      })

      describe('[delete]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, postModel)
          await createXUsersWith2Posts({
            count: 2,
            userModel,
            postModel,
            postColumn,
          })
        })

        test('[delete] child should succeed', async () => {
          await prisma[postModel].delete({
            where: { id: '1-post-a' },
          })

          const usersFromDb = await prisma[userModel].findMany({})
          expect(usersFromDb).toEqual([
            {
              id: '1',
              enabled: null,
            },
            {
              id: '2',
              enabled: null,
            },
          ])
          const postsFromDb = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(postsFromDb).toEqual([
            {
              id: '1-post-b',
              authorId: '1',
            },
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        test('[delete] children and then [delete] parent should succeed', async () => {
          await prisma[postModel].delete({
            where: { id: '1-post-a' },
          })
          await prisma[postModel].delete({
            where: { id: '1-post-b' },
          })
          await prisma[userModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({})
          expect(usersFromDb).toEqual([
            {
              id: '2',
              enabled: null,
            },
          ])
          const postsFromDb = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(postsFromDb).toEqual([
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        // test.skip('[deleteMany] parents should throw', async () => {})

        describeIf(['DEFAULT', 'Restrict'].includes(onDelete))('onDelete: DEFAULT, Restrict', () => {
          const expectedError = conditionalError.snapshot({
            foreignKeys: {
              [Providers.MONGODB]:
                "The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.",
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
              [Providers.SQLSERVER]:
                'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
              [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
            },
            prisma:
              "The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.",
          })

          test('[delete] parent should throw', async () => {
            // this throws because "postModel" has a mandatory relation with "userModel", hence
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

          test('[delete] a subset of children and then [delete] parent should throw', async () => {
            await prisma[postModel].delete({
              where: { id: '1-post-a' },
            })

            expect(
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])

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
        })

        describeIf(['NoAction'].includes(onDelete))(`onDelete: NoAction`, () => {
          const expectedError = conditionalError.snapshot({
            foreignKeys: {
              [Providers.MONGODB]:
                "The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.",
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
              [Providers.SQLSERVER]:
                'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
              [Providers.SQLITE]: 'Foreign key constraint failed on the field: `foreign key`',
            },
            prisma:
              "The change you are trying to make would violate the required relation 'PostOneToManyToUserOneToMany' between the `PostOneToMany` and `UserOneToMany` models.",
          })

          // foreignKeys
          testIf(isRI_foreignKeys)('RI=foreignKeys - [delete] parent should throw', async () => {
            // this throws because "postModel" has a mandatory relation with "userModel", hence
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
          testIf(isRI_foreignKeys)('RI=foreignKeys - [deleteMany] parents should throw', async () => {
            await prisma[postModel].delete({
              where: { id: '1-post-a' },
            })

            expect(
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])

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

          // prisma
          testIf(isRI_prisma)('RI=prisma - [delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
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
            ])
          })
          testIf(isRI_prisma)('RI=prisma - a subset of children and then [delete] parent should succeed', async () => {
            await prisma[postModel].delete({
              where: { id: '1-post-a' },
            })

            expect(
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])

            await prisma[userModel].delete({
              where: { id: '1' },
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
            ])
          })

          // Only test for foreignKeys
          testIf(isRI_foreignKeys && (isPostgreSQL || isSQLite))(
            'RI=foreignKeys - [delete] parent and child in "wrong" order a transaction when FK is DEFERRABLE should suceed',
            async () => {
              // NOT DEFERRABLE is the default.
              // THE FK constraint needs to be
              // DEFERRABLE with an INITIALLY DEFERRED or INITIALLY IMMEDIATE mode
              // to have an effect with NO ACTION
              // This is not supported by Prisma, so we use $executeRaw to set the constraint mode
              //
              // Feature request: https://github.com/prisma/prisma/issues/3502
              // It only supported by
              // SQLite: https://www.sqlite.org/foreignkeys.html
              // PostgreSQL: https://www.postgresql.org/docs/current/sql-set-constraints.html
              //
              // Not supported in
              // SQL Server https://docs.microsoft.com/en-us/openspecs/sql_standards/ms-tsqliso02/70d6050a-28c7-4fae-a205-200ccb363522
              // MySQL https://dev.mysql.com/doc/refman/8.0/en/ansi-diff-foreign-keys.html
              //
              // Interesting article https://begriffs.com/posts/2017-08-27-deferrable-sql-constraints.html
              //
              if (isPostgreSQL) {
                await prisma.$executeRaw`
                  ALTER TABLE "PostOneToMany"
                    ALTER CONSTRAINT "PostOneToMany_authorId_fkey" DEFERRABLE INITIALLY DEFERRED`
              } else if (isSQLite) {
                // Force enforcement of all foreign key constraints to be delayed until the outermost transaction is committed.
                // https://www.sqlite.org/pragma.html#pragma_defer_foreign_keys
                await prisma.$executeRaw`
                  PRAGMA defer_foreign_keys = 1`
              } else {
                throw new Error('unexpected provider')
              }

              await prisma.$transaction([
                // Deleting order does not matter anymore
                // NoAction allows the check to be deffered until the transaction is committed
                // (only when the FK set contraint is DEFERRABLE)
                prisma[postModel].delete({
                  where: { id: '1-post-a' },
                }),
                prisma[userModel].delete({
                  where: { id: '1' },
                }),
                prisma[postModel].delete({
                  where: { id: '1-post-b' },
                }),
              ])

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
              expect(
                await prisma[postModel].findMany({
                  orderBy: { id: 'asc' },
                }),
              ).toEqual([
                {
                  id: '2-post-a',
                  authorId: '2',
                },
                {
                  id: '2-post-b',
                  authorId: '2',
                },
              ])
            },
          )
        })

        describeIf(onDelete === 'Cascade')('onDelete: Cascade', () => {
          test('[delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
            })

            expect(await prisma[userModel].findMany({})).toEqual([
              {
                id: '2',
                enabled: null,
              },
            ])
            expect(
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])
          })

          test('[delete] a subset of children and then [delete] parent should succeed', async () => {
            await prisma[postModel].delete({
              where: { id: '1-post-a' },
            })

            expect(
              await prisma[postModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])

            await prisma[userModel].delete({
              where: { id: '1' },
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
