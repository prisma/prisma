import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { ProviderFlavors } from '../../_utils/providers'
import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/12862
testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    // TODO The error is correct, it does not match the query engine error format
    $test({
      failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
    })('should propagate the correct error when a method fails', async () => {
      const user = await prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.person.firstName(),
        },
      })

      await expect(
        prisma.post.create({
          data: {
            authorId: user.id,
            title: faker.lorem.sentence(),
            viewCount: -1, // should fail, must be >= 0
          },
        }),
      ).rejects.toThrow('violates check constraint \\"post_viewcount_check\\"')
    })
    // TODO The error is correct, it does not match the query engine error format
    $test({
      failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
    })('should propagate the correct error when a method fails inside an transaction', async () => {
      const user = await prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.person.firstName(),
        },
      })

      await expect(
        prisma.$transaction([
          prisma.post.create({
            data: {
              authorId: user.id,
              title: faker.lorem.sentence(),
              viewCount: -1, // should fail, must be >= 0
            },
          }),
        ]),
      ).rejects.toThrow('violates check constraint \\"post_viewcount_check\\"')
    })
    // TODO The error is correct, it does not match the query engine error format
    $test({
      failIf: providerFlavor === ProviderFlavors.JS_PG || providerFlavor === ProviderFlavors.JS_NEON,
    })('should propagate the correct error when a method fails inside an interactive transaction', async () => {
      await expect(
        prisma.$transaction(async (client) => {
          const user = await client.user.create({
            data: {
              email: faker.internet.email(),
              name: faker.person.firstName(),
            },
          })

          const post = await client.post.create({
            data: {
              authorId: user.id,
              title: faker.lorem.sentence(),
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
  },
)
