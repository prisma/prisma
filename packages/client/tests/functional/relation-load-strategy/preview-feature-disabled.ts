import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ provider }, _suiteMeta, _clientMeta, cliMeta) => {
    const relationJoinsDisabled = !cliMeta.previewFeatures.includes('relationJoins')
    const fullTextSearchEnabled =
      cliMeta.previewFeatures.includes('fullTextSearch') &&
      (provider === Providers.POSTGRESQL || provider === Providers.MYSQL)

    describeIf(relationJoinsDisabled)('relationLoadStrategy with no relationJoins preview feature', () => {
      test('findMany', async () => {
        const query = prisma.user.findMany({
          // @ts-expect-error
          relationLoadStrategy: 'query',
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX 
                                                  XX describeIf(relationJoinsDisabled)('relationLoadStrategy with no relationJoins preview feature', () => {
                                                  XX   test('findMany', async () => {
                                                → XX     const query = prisma.user.findMany({
                                                           relationLoadStrategy: "query",
                                                           ~~~~~~~~~~~~~~~~~~~~
                                                         ? where?: UserWhereInput,
                                                         ? orderBy?: UserOrderByWithRelationAndSearchRelevanceInput[] | UserOrderByWithRelationAndSearchRelevanceInput,
                                                         ? cursor?: UserWhereUniqueInput,
                                                         ? take?: Int,
                                                         ? skip?: Int,
                                                         ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                                         })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.findMany()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX 
                                                              XX describeIf(relationJoinsDisabled)('relationLoadStrategy with no relationJoins preview feature', () => {
                                                              XX   test('findMany', async () => {
                                                            → XX     const query = prisma.user.findMany({
                                                                       relationLoadStrategy: "query",
                                                                       ~~~~~~~~~~~~~~~~~~~~
                                                                     ? where?: UserWhereInput,
                                                                     ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                                                                     ? cursor?: UserWhereUniqueInput,
                                                                     ? take?: Int,
                                                                     ? skip?: Int,
                                                                     ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                                                     })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        }
      })

      test('findFirst', async () => {
        const query = prisma.user.findFirst({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findFirst()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('findFirst', async () => {
                                                → XX   const query = prisma.user.findFirst({
                                                         relationLoadStrategy: "query",
                                                         ~~~~~~~~~~~~~~~~~~~~
                                                         where: {
                                                           login: "user"
                                                         },
                                                       ? orderBy?: UserOrderByWithRelationAndSearchRelevanceInput[] | UserOrderByWithRelationAndSearchRelevanceInput,
                                                       ? cursor?: UserWhereUniqueInput,
                                                       ? take?: Int,
                                                       ? skip?: Int,
                                                       ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                                       })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.findFirst()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('findFirst', async () => {
                                                            → XX   const query = prisma.user.findFirst({
                                                                     relationLoadStrategy: "query",
                                                                     ~~~~~~~~~~~~~~~~~~~~
                                                                     where: {
                                                                       login: "user"
                                                                     },
                                                                   ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                                                                   ? cursor?: UserWhereUniqueInput,
                                                                   ? take?: Int,
                                                                   ? skip?: Int,
                                                                   ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                                                   })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        }
      })

      test('findFirstOrThrow', async () => {
        const query = prisma.user.findFirstOrThrow({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                    Invalid \`prisma.user.findFirstOrThrow()\` invocation in
                                    /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                      XX })
                                      XX 
                                      XX test('findFirstOrThrow', async () => {
                                    → XX   const query = prisma.user.findFirstOrThrow({
                                              relationLoadStrategy: "query",
                                              ~~~~~~~~~~~~~~~~~~~~
                                              where: {
                                                login: "user"
                                              },
                                            ? orderBy?: UserOrderByWithRelationAndSearchRelevanceInput[] | UserOrderByWithRelationAndSearchRelevanceInput,
                                            ? cursor?: UserWhereUniqueInput,
                                            ? take?: Int,
                                            ? skip?: Int,
                                            ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                            })

                                    Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                              `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.findFirstOrThrow()\` invocation in
                        /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                          XX })
                          XX 
                          XX test('findFirstOrThrow', async () => {
                        → XX   const query = prisma.user.findFirstOrThrow({
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  where: {
                                    login: "user"
                                  },
                                ? orderBy?: UserOrderByWithRelationInput[] | UserOrderByWithRelationInput,
                                ? cursor?: UserWhereUniqueInput,
                                ? take?: Int,
                                ? skip?: Int,
                                ? distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        }
      })

      test('findUnique', async () => {
        const query = prisma.user.findUnique({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findUnique()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('findUnique', async () => {
                                                → XX   const query = prisma.user.findUnique({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          where: {
                                                            login: "user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.findUnique()\` invocation in
                        /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                          XX })
                          XX 
                          XX test('findUnique', async () => {
                        → XX   const query = prisma.user.findUnique({
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  where: {
                                    login: "user"
                                  }
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        }
      })

      test('findUniqueOrThrow', async () => {
        const query = prisma.user.findUniqueOrThrow({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.findUniqueOrThrow()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('findUniqueOrThrow', async () => {
                                                → XX   const query = prisma.user.findUniqueOrThrow({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          where: {
                                                            login: "user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.findUniqueOrThrow()\` invocation in
                        /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                          XX })
                          XX 
                          XX test('findUniqueOrThrow', async () => {
                        → XX   const query = prisma.user.findUniqueOrThrow({
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  where: {
                                    login: "user"
                                  }
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        }
      })

      test('create', async () => {
        const query = prisma.user.create({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          data: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.create()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('create', async () => {
                                                → XX   const query = prisma.user.create({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          data: {
                                                            login: "user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                        Invalid \`prisma.user.create()\` invocation in
                        /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                          XX })
                          XX 
                          XX test('create', async () => {
                        → XX   const query = prisma.user.create({
                                  relationLoadStrategy: "query",
                                  ~~~~~~~~~~~~~~~~~~~~
                                  data: {
                                    login: "user"
                                  }
                                })

                        Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                    `)
        }
      })

      test('update', async () => {
        const query = prisma.user.update({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
          data: {
            login: 'new-user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.update()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('update', async () => {
                                                → XX   const query = prisma.user.update({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          where: {
                                                            login: "user"
                                                          },
                                                          data: {
                                                            login: "new-user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.update()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('update', async () => {
                                                            → XX   const query = prisma.user.update({
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                      where: {
                                                                        login: "user"
                                                                      },
                                                                      data: {
                                                                        login: "new-user"
                                                                      }
                                                                    })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        }
      })

      test('delete', async () => {
        const query = prisma.user.delete({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.delete()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('delete', async () => {
                                                → XX   const query = prisma.user.delete({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          where: {
                                                            login: "user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.delete()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('delete', async () => {
                                                            → XX   const query = prisma.user.delete({
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                      where: {
                                                                        login: "user"
                                                                      }
                                                                    })

                                                            Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                                  `)
        }
      })

      test('upsert', async () => {
        const query = prisma.user.upsert({
          // @ts-expect-error
          relationLoadStrategy: 'query',
          where: {
            login: 'user',
          },
          create: {
            login: 'user',
          },
          update: {
            login: 'new-user',
          },
        })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.upsert()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX })
                                                  XX 
                                                  XX test('upsert', async () => {
                                                → XX   const query = prisma.user.upsert({
                                                          relationLoadStrategy: "query",
                                                          ~~~~~~~~~~~~~~~~~~~~
                                                          where: {
                                                            login: "user"
                                                          },
                                                          create: {
                                                            login: "user"
                                                          },
                                                          update: {
                                                            login: "new-user"
                                                          }
                                                        })

                                                Unknown argument \`relationLoadStrategy\`. Available options are marked with ?.
                                        `)
        } else {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                            Invalid \`prisma.user.upsert()\` invocation in
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX })
                                                              XX 
                                                              XX test('upsert', async () => {
                                                            → XX   const query = prisma.user.upsert({
                                                                      relationLoadStrategy: "query",
                                                                      ~~~~~~~~~~~~~~~~~~~~
                                                                      where: {
                                                                        login: "user"
                                                                      },
                                                                      create: {
                                                                        login: "user"
                                                                      },
                                                                      update: {
                                                                        login: "new-user"
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
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
        const query =
          // @ts-test-if: provider !== 'sqlite'
          prisma.user.createMany({
            // @ts-test-if: provider === 'sqlite'
            relationLoadStrategy: 'query',
            data: [{ login: 'user' }],
          })

        if (fullTextSearchEnabled) {
          await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

                                                Invalid \`prisma.user.createMany()\` invocation in
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                  XX testIf(![Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB].includes(provider))('createMany', async () => {
                                                  XX   const query =
                                                  XX     // @ts-test-if: provider !== 'sqlite'
                                                → XX     prisma.user.createMany({
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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

                                                              XX testIf(![Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB].includes(provider))('createMany', async () => {
                                                              XX   const query =
                                                              XX     // @ts-test-if: provider !== 'sqlite'
                                                            → XX     prisma.user.createMany({
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

          if (fullTextSearchEnabled) {
            await expect(query).rejects.toMatchPrismaErrorInlineSnapshot()
          } else {
            await expect(query).rejects.toMatchPrismaErrorInlineSnapshot(`

              Invalid \`prisma.user.createMany()\` invocation in
              /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
          }
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
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
                                                            /client/tests/functional/relation-load-strategy/preview-feature-disabled.ts:0:0

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
