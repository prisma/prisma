import { faker } from '@faker-js/faker'
import { match } from 'ts-pattern'

import { Providers } from '../_utils/providers'
import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import { providersSupportingRelationJoins, RelationLoadStrategy } from './_common'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

let prisma: PrismaClient<PrismaNamespace.PrismaClientOptions, 'query'>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig, _suiteMeta, _clientMeta, cliMeta) => {
  const relationJoinsEnabled = cliMeta.previewFeatures.includes('relationJoins')

  // We can't use `Object.keys(Prisma.RelationLoadStrategy).includes(suiteConfig.strategy)` here to let
  // the DMMF tell us because the `Prisma` object is not injected at this point yet.
  const strategySupportedForProvider = match(suiteConfig.strategy)
    .with('join', () => providersSupportingRelationJoins.includes(suiteConfig.provider))
    .with('query', () => true)
    .exhaustive()

  describeIf(relationJoinsEnabled && strategySupportedForProvider)('relationLoadStrategy in supported queries', () => {
    const relationLoadStrategy = suiteConfig.strategy as PrismaNamespace.RelationLoadStrategy

    const postId = faker.database.mongodbObjectId()

    const logs: PrismaNamespace.QueryEvent[] = []

    async function expectQueryCountAtLeast(count: Record<RelationLoadStrategy, number>) {
      await waitFor(() => {
        expect(logs.length).toBeGreaterThanOrEqual(count[suiteConfig.strategy])
      })
    }

    function expectLateralJoinToBeUsedIfRequested() {
      const pattern = expect.arrayContaining([
        expect.objectContaining({ query: expect.stringMatching('LEFT JOIN LATERAL') }),
      ])

      if (suiteConfig.strategy === 'join') {
        expect(logs).toEqual(pattern)
      } else {
        expect(logs).not.toEqual(pattern)
      }
    }

    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      prisma.$on('query', (event) => {
        logs.push(event)
      })

      await prisma.$connect()
    })

    beforeEach(async () => {
      await prisma.comment.deleteMany()
      await prisma.post.deleteMany()
      await prisma.user.deleteMany()

      await prisma.user.create({
        data: {
          login: 'author',
          posts: {
            create: {
              id: postId,
              title: 'first post',
              content: 'insightful content',
            },
          },
        },
      })

      await prisma.user.create({
        data: {
          login: 'commenter',
          comments: {
            create: {
              post: {
                connect: { id: postId },
              },
              body: 'a comment',
            },
          },
        },
      })

      logs.length = 0
    })

    test('findMany', async () => {
      await expect(
        prisma.user.findMany({
          relationLoadStrategy,
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    author: {
                      select: { login: true },
                    },
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        [
          {
            login: author,
            posts: [
              {
                comments: [
                  {
                    author: {
                      login: commenter,
                    },
                    body: a comment,
                  },
                ],
                title: first post,
              },
            ],
          },
          {
            login: commenter,
            posts: [],
          },
        ]
      `)

      await expectQueryCountAtLeast({
        join: 1,
        query: 4,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('findFirst', async () => {
      await expect(
        prisma.user.findFirst({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    author: {
                      select: {
                        login: true,
                      },
                    },
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: author,
          posts: [
            {
              comments: [
                {
                  author: {
                    login: commenter,
                  },
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 1,
        query: 4,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('findFirstOrThrow', async () => {
      await expect(
        prisma.user.findFirstOrThrow({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    author: {
                      select: {
                        login: true,
                      },
                    },
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: author,
          posts: [
            {
              comments: [
                {
                  author: {
                    login: commenter,
                  },
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 1,
        query: 4,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('findUnique', async () => {
      await expect(
        prisma.user.findUnique({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    author: {
                      select: {
                        login: true,
                      },
                    },
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: author,
          posts: [
            {
              comments: [
                {
                  author: {
                    login: commenter,
                  },
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 1,
        query: 4,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('findUniqueOrThrow', async () => {
      await expect(
        prisma.user.findUniqueOrThrow({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    author: {
                      select: {
                        login: true,
                      },
                    },
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: author,
          posts: [
            {
              comments: [
                {
                  author: {
                    login: commenter,
                  },
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 1,
        query: 4,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('create', async () => {
      await expect(
        prisma.user.create({
          relationLoadStrategy,
          data: {
            login: 'reader',
            comments: {
              create: {
                post: {
                  connect: { id: postId },
                },
                body: 'most insightful indeed!',
              },
            },
          },
          select: {
            login: true,
            comments: {
              select: {
                post: {
                  select: {
                    title: true,
                  },
                },
                body: true,
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          comments: [
            {
              body: most insightful indeed!,
              post: {
                title: first post,
              },
            },
          ],
          login: reader,
        }
      `)

      await expectQueryCountAtLeast({
        join: 6,
        query: suiteConfig.provider === Providers.MONGODB ? 6 : 8,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('update', async () => {
      await expect(
        prisma.user.update({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          data: {
            login: 'distinguished author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: distinguished author,
          posts: [
            {
              comments: [
                {
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 4,
        query: 6,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('delete', async () => {
      await expect(
        prisma.user.delete({
          relationLoadStrategy,
          where: {
            login: 'author',
          },
          select: {
            login: true,
            posts: {
              select: {
                title: true,
                comments: {
                  select: {
                    body: true,
                  },
                },
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          login: author,
          posts: [
            {
              comments: [
                {
                  body: a comment,
                },
              ],
              title: first post,
            },
          ],
        }
      `)

      await expectQueryCountAtLeast({
        join: 4,
        query: 6,
      })

      expectLateralJoinToBeUsedIfRequested()
    })

    test('upsert', async () => {
      await expect(
        prisma.user.upsert({
          relationLoadStrategy,
          where: {
            login: 'commenter',
          },
          create: {
            login: 'commenter',
          },
          update: {
            login: 'ardent commenter',
          },
          select: {
            login: true,
            comments: {
              select: {
                post: {
                  select: {
                    title: true,
                  },
                },
                body: true,
              },
            },
          },
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          comments: [
            {
              body: a comment,
              post: {
                title: first post,
              },
            },
          ],
          login: ardent commenter,
        }
      `)

      await expectQueryCountAtLeast({
        join: 5,
        query: suiteConfig.provider === Providers.MONGODB ? 6 : 7,
      })

      expectLateralJoinToBeUsedIfRequested()
    })
  })
})
