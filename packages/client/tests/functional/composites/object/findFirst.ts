import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
import { commentDataA } from './_testData'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.comment.create({ data: commentDataA(id) })
  })

  test('simple', async () => {
    const comment = await prisma.comment.findFirst({
      where: { id },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        content: {
          text: Hello World,
          upvotes: [
            {
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
      {
        content: {
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
      {
        content: {
          text: Hello World,
          upvotes: [
            {
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
