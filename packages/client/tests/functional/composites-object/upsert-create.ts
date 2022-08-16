import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuite(({ contentProperty }) => {
  let id: string
  beforeEach(() => {
    id = faker.database.mongodbObjectId()
  })

  test('set', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          set: {
            text: 'Hello World',
            upvotes: {
              vote: true,
              userId: '10',
            },
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('set shorthand', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          text: 'Hello World',
          upvotes: {
            vote: true,
            userId: '10',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
          ],
        },
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('set null', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          // @ts-test-if: contentProperty === 'optional'
          set: null,
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
        Object {
          content: null,
          country: France,
          id: Any<String>,
        }
      `,
      )
    } else {
      await expect(comment).rejects.toThrowError(
        expect.objectContaining({
          message: expect.stringContaining('Argument set for create.content.set must not be null'),
        }),
      )
    }
  })

  test('set null shorthand', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        // @ts-test-if: contentProperty === 'optional'
        content: null,
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
        Object {
          content: null,
          country: France,
          id: Any<String>,
        }
      `,
      )
    } else {
      expect.objectContaining({
        message: expect.stringContaining('Got invalid value null on prisma.upsertOneCommentRequiredProp'),
      })
    }
  })

  test('set nested list', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        content: {
          set: {
            text: 'Hello World',
            upvotes: [
              { userId: '10', vote: true },
              { userId: '11', vote: true },
            ],
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      Object {
        content: Object {
          text: Hello World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: true,
            },
            Object {
              userId: 11,
              vote: true,
            },
          ],
        },
        country: France,
        id: Any<String>,
      }
    `,
    )
  })
})
