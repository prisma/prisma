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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
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
          country: null,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(`
      Array [
        Object {
          contents: Array [
            Object {
              text: Hello World,
            },
          ],
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }, { id: expect.any(String) }],
      `
      Array [
        Object {
          contents: Array [
            Object {
              text: Goodbye World,
              upvotes: Array [
                Object {
                  userId: 11,
                  vote: false,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [
                Object {
                  userId: 10,
                  vote: true,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [],
            },
          ],
          country: France,
          id: Any<String>,
        },
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
          country: null,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
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
          country: null,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
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
          country: null,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
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
          country: null,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
        Object {
          contents: Array [
            Object {
              text: Goodbye World,
              upvotes: Array [
                Object {
                  userId: 11,
                  vote: false,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [
                Object {
                  userId: 10,
                  vote: true,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [],
            },
          ],
          country: France,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
        Object {
          contents: Array [
            Object {
              text: Goodbye World,
              upvotes: Array [
                Object {
                  userId: 11,
                  vote: false,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [
                Object {
                  userId: 10,
                  vote: true,
                },
              ],
            },
            Object {
              text: Hello World,
              upvotes: Array [],
            },
          ],
          country: France,
          id: Any<String>,
        },
      ]
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

    expect(comment).toMatchInlineSnapshot(
      [{ id: expect.any(String) }],
      `
      Array [
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
          country: null,
          id: Any<String>,
        },
      ]
    `,
    )
  })
})
