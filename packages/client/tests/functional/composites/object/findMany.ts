import { setupTestSuite } from './_matrix'
import { commentDataA, commentDataB } from './_testData'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// can't use faker ids here because the order between generated ids is arbitrary
const id1 = '8aaaaaaaaaaaaaaaaaaaaaaa'
const id2 = '1ddddddddddddddddddddddd'

setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.comment.createMany({
      data: [commentDataA(id1), commentDataB(id2)],
    })
  })

  test('simple', async () => {
    const comment = await prisma.comment.findMany({
      where: { id: id1 },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('select', async () => {
    const comment = await prisma.comment.findMany({
      where: { id: id1 },
      select: {
        content: {
          select: {
            text: true,
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(`
      [
        {
          content: {
            text: Hello World,
          },
        },
      ]
    `)
  })

  test('orderBy', async () => {
    const comment = await prisma.comment.findMany({
      where: { OR: [{ id: id1 }, { id: id2 }] },
      orderBy: {
        content: {
          upvotes: {
            _count: 'desc',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
        {
          content: {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
              {
                userId: 12,
                vote: true,
              },
            ],
          },
          country: France,
          id: 1ddddddddddddddddddddddd,
        },
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('filter equals', async () => {
    const comment = await prisma.comment.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { equals: commentDataA(id1).content.set },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('filter equals shorthand', async () => {
    const comment = await prisma.comment.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: commentDataA(id1).content.set,
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('filter is', async () => {
    const comment = await prisma.comment.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { is: { OR: [{ text: 'Hello World' }, { text: 'Goodbye World' }] } },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
        {
          content: {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
              {
                userId: 12,
                vote: true,
              },
            ],
          },
          country: France,
          id: 1ddddddddddddddddddddddd,
        },
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('filter isNot', async () => {
    const comment = await prisma.comment.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        content: { isNot: { text: 'Goodbye World' } },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
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
          id: 8aaaaaaaaaaaaaaaaaaaaaaa,
        },
      ]
    `,
    )
  })

  test('filter isSet', async () => {
    const comment = await prisma.comment.findMany({
      where: {
        OR: [{ id: id1 }, { id: id2 }],
        country: { isSet: true },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      `
      [
        {
          content: {
            text: Goodbye World,
            upvotes: [
              {
                userId: 11,
                vote: false,
              },
              {
                userId: 12,
                vote: true,
              },
            ],
          },
          country: France,
          id: 1ddddddddddddddddddddddd,
        },
      ]
    `,
    )
  })
})
