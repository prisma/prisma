import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'
import { commentListDataA, commentListDataB } from './_testData'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id1 = faker.database.mongodbObjectId()
const id2 = faker.database.mongodbObjectId()

setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.commentRequiredList.createMany({
      data: [commentListDataA(id1), commentListDataB(id2)],
    })
  })

  test('simple', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { id: id1 },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('select', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { id: id1 },
      select: {
        contents: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(`
      {
        contents: [
          {
            text: Hello World,
          },
        ],
      }
    `)
  })

  test('orderBy', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: { OR: [{ id: id1 }, { id: id2 }] },
      orderBy: {
        contents: {
          _count: 'desc',
        },
      },
    })

    expect(comment).toHaveLength(2)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [],
          },
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
    expect(comment[1]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
  `,
    )
  })

  test('filter equals', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: { equals: commentListDataA(id1).contents.set },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter equals shorthand', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: commentListDataA(id1).contents.set,
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter every', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: { every: { upvotes: { every: { vote: true } } } },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter some', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: { some: { upvotes: { some: { vote: false } } } },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [],
          },
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter empty', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: { some: { upvotes: { isEmpty: true } } },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
          {
            text: Hello World,
            upvotes: [],
          },
        ],
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('filter none', async () => {
    const comment = await prisma.commentRequiredList.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        contents: { none: { upvotes: { isEmpty: true } } },
      },
    })

    expect(comment).toHaveLength(1)
    expect(comment[0]).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
            ],
          },
        ],
        country: null,
        id: Any<String>,
      }
    `,
    )
  })
})
