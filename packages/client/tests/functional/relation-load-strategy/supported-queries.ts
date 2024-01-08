import { faker } from '@faker-js/faker'
import { match } from 'ts-pattern'

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

    async function expectQueryCount(count: Record<RelationLoadStrategy, number>) {
      await waitFor(() => {
        expect(logs.length).toBe(count[relationLoadStrategy])
      })
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

      await expectQueryCount({
        join: 1,
        query: 4,
      })
    })
  })
})
