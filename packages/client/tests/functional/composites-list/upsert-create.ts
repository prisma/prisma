import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuite(() => {
  let id: string
  beforeEach(() => {
    id = faker.database.mongodbObjectId()
  })

  test('set', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
          set: [
            {
              text: 'Hello World',
              upvotes: {
                vote: true,
                userId: '10',
              },
            },
          ],
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      Object {
        contents: Array [
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  /**
   * Set shorthand
   */
  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
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
        contents: Array [
          Object {
            text: Hello World,
            upvotes: Array [
              Object {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  /**
   * Set null
   */
  test('set null', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        country: 'France',
        // @ts-expect-error
        contents: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for create.contents.set must not be null'),
      }),
    )
  })

  /**
   * Set null shorthand
   */
  test('set null shorthand', async () => {
    const comment = prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        country: 'France',
        // @ts-expect-error
        contents: null,
      },
    })

    await expect(comment).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Argument contents for create.contents must not be null'),
      }),
    )
  })

  /**
   * Set nested list
   */
  test('set nested list', async () => {
    const comment = await prisma.commentRequiredList.upsert({
      where: { id },
      update: {},
      create: {
        id,
        country: 'France',
        contents: {
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
        contents: Array [
          Object {
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
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
  })
})
