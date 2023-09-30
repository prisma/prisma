// @ts-ignore
import type { PrismaClient } from '@prisma/client'
import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/12862
testMatrix.setupTestSuite(
  () => {
    test('should propagate the correct error when a method fails', async () => {
      const user = await prisma.user.create({
        data: {
          email: copycat.email(91),
          name: copycat.firstName(12),
        },
      })

      await expect(
        prisma.post.create({
          data: {
            authorId: user.id,
            title: copycat.words(3),
            viewCount: -1, // should fail, must be >= 0
          },
        }),
      ).rejects.toThrow('violates check constraint \\"post_viewcount_check\\"')
    })

    test('should propagate the correct error when a method fails inside an transaction', async () => {
      const user = await prisma.user.create({
        data: {
          email: copycat.email(47),
          name: copycat.firstName(96),
        },
      })

      await expect(
        prisma.$transaction([
          prisma.post.create({
            data: {
              authorId: user.id,
              title: copycat.words(18),
              viewCount: -1, // should fail, must be >= 0
            },
          }),
        ]),
      ).rejects.toThrow('violates check constraint \\"post_viewcount_check\\"')
    })

    test('should propagate the correct error when a method fails inside an interactive transaction', async () => {
      await expect(
        prisma.$transaction(async (client) => {
          const user = await client.user.create({
            data: {
              email: copycat.email(76),
              name: copycat.firstName(4),
            },
          })

          const post = await client.post.create({
            data: {
              authorId: user.id,
              title: copycat.words(22),
              viewCount: -1, // should fail, must be >= 0
            },
          })

          return post
        }),
      ).rejects.toThrow('violates check constraint \\"post_viewcount_check\\"')
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'sqlite', 'sqlserver'],
      reason: 'Issue relates to postgresql only',
    },
    alterStatementCallback: () => `
      ALTER TABLE "Post" 
      ADD CONSTRAINT Post_viewCount_check CHECK ("viewCount" >= 0);
    `,
    skipProviderFlavor: {
      from: ['js_pg'],
      reason: 'The error is correct, it does not match the query engine error format',
    },
  },
)
