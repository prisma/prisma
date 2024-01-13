import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider }, _suiteMeta, _clientMeta, cliMeta) => {
    const relationJoinsEnabled = cliMeta.previewFeatures.includes('relationJoins')
    const fullTextSearchEnabled =
      cliMeta.previewFeatures.includes('fullTextSearch') &&
      (provider === Providers.POSTGRESQL || provider === Providers.MYSQL)

    describeIf(relationJoinsEnabled)('relationLoadStrategy in unsupported positions', () => {
      test('nested subquery in findMany using include', async () => {
        const query = prisma.user.findMany({
          include: {
            posts: {
              // @ts-expect-error
              relationLoadStrategy: 'query',
              include: {
                comments: true,
              },
            },
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.findMany()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                              XX 
                                                              XX describeIf(relationJoinsEnabled)('relationLoadStrategy in unsupported positions', () => {
                                                              XX   test('nested subquery in findMany using include', async () => {
                                                            → XX     const query = prisma.user.findMany({
                                                                       include: {
                                                                         posts: {
                                                                           relationLoadStrategy: "query",
                                                                           ~~~~~~~~~~~~~~~~~~~~
                                                                           include: {
                                                                             comments: true
                                                                           },
                                                                     ?     where?: PostWhereInput,
                                                                     ?     orderBy?: PostOrderByWithRelationAndSearchRelevanceInput[] | PostOrderByWithRelationAndSearchRelevanceInput,
                                                                     ?     cursor?: PostWhereUniqueInput,
                                                                     ?     take?: Int,
                                                                     ?     skip?: Int,
                                                                     ?     distinct?: PostScalarFieldEnum | PostScalarFieldEnum[]
                                                                         }
                                                                       }
                                                                     })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX 
                                                  XX describeIf(relationJoinsEnabled)('relationLoadStrategy in unsupported positions', () => {
                                                  XX   test('nested subquery in findMany using include', async () => {
                                                → XX     const query = prisma.user.findMany({
                                                           include: {
                                                             posts: {
                                                               relationLoadStrategy: "query",
                                                               ~~~~~~~~~~~~~~~~~~~~
                                                               include: {
                                                                 comments: true
                                                               },
                                                         ?     where?: PostWhereInput,
                                                         ?     orderBy?: PostOrderByWithRelationInput[] | PostOrderByWithRelationInput,
                                                         ?     cursor?: PostWhereUniqueInput,
                                                         ?     take?: Int,
                                                         ?     skip?: Int,
                                                         ?     distinct?: PostScalarFieldEnum | PostScalarFieldEnum[]
                                                             }
                                                           }
                                                         })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      test('nested subquery in findMany using select', async () => {
        const query = prisma.user.findMany({
          select: {
            posts: {
              // @ts-expect-error
              relationLoadStrategy: 'query',
              select: {
                id: true,
                comments: true,
              },
            },
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.findMany()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('nested subquery in findMany using select', async () => {
                                                            → XX   const query = prisma.user.findMany({
                                                                     select: {
                                                                       posts: {
                                                                         relationLoadStrategy: "query",
                                                                         ~~~~~~~~~~~~~~~~~~~~
                                                                         select: {
                                                                           id: true,
                                                                           comments: true
                                                                         },
                                                                   ?     where?: PostWhereInput,
                                                                   ?     orderBy?: PostOrderByWithRelationAndSearchRelevanceInput[] | PostOrderByWithRelationAndSearchRelevanceInput,
                                                                   ?     cursor?: PostWhereUniqueInput,
                                                                   ?     take?: Int,
                                                                   ?     skip?: Int,
                                                                   ?     distinct?: PostScalarFieldEnum | PostScalarFieldEnum[]
                                                                       }
                                                                     }
                                                                   })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('nested subquery in findMany using select', async () => {
                                                → XX   const query = prisma.user.findMany({
                                                         select: {
                                                           posts: {
                                                             relationLoadStrategy: "query",
                                                             ~~~~~~~~~~~~~~~~~~~~
                                                             select: {
                                                               id: true,
                                                               comments: true
                                                             },
                                                       ?     where?: PostWhereInput,
                                                       ?     orderBy?: PostOrderByWithRelationInput[] | PostOrderByWithRelationInput,
                                                       ?     cursor?: PostWhereUniqueInput,
                                                       ?     take?: Int,
                                                       ?     skip?: Int,
                                                       ?     distinct?: PostScalarFieldEnum | PostScalarFieldEnum[]
                                                           }
                                                         }
                                                       })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      test('aggregate', async () => {
        const query = prisma.user.aggregate({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          _count: {
            _all: true,
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.aggregate()\` invocation in
                        /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                          XX })
                          XX 
                          XX test('aggregate', async () => {
                        → XX   const query = prisma.user.aggregate({
                                  select: {
                                    _count: {
                                      select: {
                                        _all: true
                                      }
                                    }
                                  },
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                ? where?: UserWhereInput,
                                ? orderBy?: UserOrderByWithRelationAndSearchRelevanceInput[] | UserOrderByWithRelationAndSearchRelevanceInput,
                                ? cursor?: UserWhereUniqueInput,
                                ? take?: Int,
                                ? skip?: Int
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.aggregate()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('aggregate', async () => {
                                                → XX   const query = prisma.user.aggregate({
                                                          select: {
                                                            _count: {
                                                              select: {
                                                                _all: true
                                                              }
                                                            }
                                                          },
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                        ? where?: UserWhereInput,
                                                        ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                                                        ? cursor?: UserWhereUniqueInput,
                                                        ? take?: Int,
                                                        ? skip?: Int
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      test('groupBy', async () => {
        const query = prisma.user.groupBy({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          by: 'id',
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.groupBy()\` invocation in
                        /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                          XX })
                          XX 
                          XX test('groupBy', async () => {
                        → XX   const query = prisma.user.groupBy({
                                  select: {
                                    id: true
                                  },
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  by: "id",
                                ? where?: UserWhereInput,
                                ? orderBy?: UserOrderByWithAggregationInput[] | UserOrderByWithAggregationInput,
                                ? having?: UserScalarWhereWithAggregatesInput,
                                ? take?: Int,
                                ? skip?: Int
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.groupBy()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('groupBy', async () => {
                                                → XX   const query = prisma.user.groupBy({
                                                          select: {
                                                            id: true
                                                          },
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          by: "id",
                                                        ? where?: UserWhereInput,
                                                        ? orderBy?: UserOrderByWithAggregationInput[] | UserOrderByWithAggregationInput,
                                                        ? having?: UserScalarWhereWithAggregatesInput,
                                                        ? take?: Int,
                                                        ? skip?: Int
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      testIf(![Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB].includes(provider))('createMany', async () => {
        // @ts-test-if: provider !== 'sqlite'
        const query = prisma.user.createMany({
          // @ts-test-if: provider === 'sqlite'
          relationLoadStrategy: 'query',
          data: [{ login: 'user' }],
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.createMany()\` invocation in
                        /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                          XX 
                          XX testIf(![Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB].includes(provider))('createMany', async () => {
                          XX   // @ts-test-if: provider !== 'sqlite'
                        → XX   const query = prisma.user.createMany({
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  data: [
                                    {
                                      login: "user"
                                    }
                                  ],
                                ? skipDuplicates?: Boolean
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                    Invalid \`prisma.user.createMany()\` invocation in
                                    /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                      XX 
                                      XX testIf(![Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB].includes(provider))('createMany', async () => {
                                      XX   // @ts-test-if: provider !== 'sqlite'
                                    → XX   const query = prisma.user.createMany({
                                              relationLoadStrategy: "query",
                                              ~~~~~~~~~~~~~~~~~~~~
                                              data: [
                                                {
                                                  login: "user"
                                                }
                                              ],
                                            ? skipDuplicates?: Boolean
                                            })

                                    Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                              `)
        }
      })

      testIf([Providers.SQLSERVER, Providers.MONGODB].includes(provider))(
        'createMany (sqlserver, mongodb)',
        async () => {
          // @ts-test-if: provider !== 'sqlite'
          const query = prisma.user.createMany({
            // @ts-test-if: provider === 'sqlite'
            relationLoadStrategy: 'query',
            data: [{ login: 'user' }],
          })

          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

              Invalid \`prisma.user.createMany()\` invocation in
              /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                XX 'createMany (sqlserver, mongodb)',
                XX async () => {
                XX   // @ts-test-if: provider !== 'sqlite'
              → XX   const query = prisma.user.createMany({
                        relationLoadStrategy: "query",
                        ~~~~~~~~~~~~~~~~~~~~
                        data: [
                          {
                            login: "user"
                          }
                        ]
                      })

              Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
            `)
        },
      )

      test('updateMany', async () => {
        const query = prisma.user.updateMany({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          data: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.updateMany()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                              XX )
                                                              XX 
                                                              XX test('updateMany', async () => {
                                                            → XX   const query = prisma.user.updateMany({
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                      data: {
                                                                        login: "user"
                                                                      },
                                                                    ? where?: UserWhereInput
                                                                    })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.updateMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX )
                                                  XX 
                                                  XX test('updateMany', async () => {
                                                → XX   const query = prisma.user.updateMany({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          data: {
                                                            login: "user"
                                                          },
                                                        ? where?: UserWhereInput
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      test('deleteMany', async () => {
        const query = prisma.user.deleteMany({
          // @ts-expect-error
          relationLoadStrategy: 'query',
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.deleteMany()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('deleteMany', async () => {
                                                            → XX   const query = prisma.user.deleteMany({
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                    ? where?: UserWhereInput
                                                                    })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.deleteMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('deleteMany', async () => {
                                                → XX   const query = prisma.user.deleteMany({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                        ? where?: UserWhereInput
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })

      test('count', async () => {
        const query = prisma.user.count({
          // @ts-expect-error
          relationLoadStrategy: 'query',
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.count()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('count', async () => {
                                                            → XX   const query = prisma.user.count({
                                                                      select: {
                                                                        _count: {
                                                                          select: {
                                                                            _all: true
                                                                          }
                                                                        }
                                                                      },
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                    ? where?: UserWhereInput,
                                                                    ? orderBy?: UserOrderByWithRelationAndSearchRelevanceInput[] | UserOrderByWithRelationAndSearchRelevanceInput,
                                                                    ? cursor?: UserWhereUniqueInput,
                                                                    ? take?: Int,
                                                                    ? skip?: Int
                                                                    })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.count()\` invocation in
                                                /client/tests/functional/relation-load-strategy/unsupported-queries.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('count', async () => {
                                                → XX   const query = prisma.user.count({
                                                          select: {
                                                            _count: {
                                                              select: {
                                                                _all: true
                                                              }
                                                            }
                                                          },
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                        ? where?: UserWhereInput,
                                                        ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                                                        ? cursor?: UserWhereUniqueInput,
                                                        ? take?: Int,
                                                        ? skip?: Int
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        }
      })
    })
  },
  {
    skipDataProxy: {
      runtimes: ['edge'],
      reason: 'Errors are formatted differently in edge client, so snapshots mismatch',
    },
  },
)
