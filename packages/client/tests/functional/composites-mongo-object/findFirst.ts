import { faker } from '@faker-js/faker'
import pRetry from 'p-retry'

import { setupTestSuite } from './_matrix'
import { commentDataA } from './_testData'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const id = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await pRetry(
      async () => {
        await prisma.comment.create({ data: commentDataA(id) })
      },
      { retries: 2 },
    )
  })

  test('simple', async () => {
    const comment = await prisma.comment.findFirst({
      where: { id },
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
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('select', async () => {
    const comment = await prisma.comment.findFirst({
      where: { id },
      select: {
        content: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      Object {
        content: Object {
          text: Hello World,
        },
      }
    `)
  })

  test('orderBy', async () => {
    const comment = await prisma.comment.findFirst({
      where: { id },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
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
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter isSet', async () => {
    const comment = await prisma.comment.findFirst({
      where: { id, country: { isSet: true } },
    })

    expect(comment).toBeNull()
  })
})
