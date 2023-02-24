import { getQueryEngineProtocol } from '@prisma/internals'

import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

setupTestSuite(() => {
  test('set', async () => {
    const comment = await prisma.commentRequiredList.create({
      data: {
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
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('set shorthand', async () => {
    const comment = await prisma.commentRequiredList.create({
      data: {
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
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  testIf(getQueryEngineProtocol() !== 'json')('set null', async () => {
    const comment = prisma.commentRequiredList.create({
      data: {
        country: 'France',
        // @ts-expect-error
        contents: {
          set: null,
        },
      },
    })

    await expect(comment).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('Argument set for data.contents.set must not be null'),
      }),
    )
  })

  testIf(getQueryEngineProtocol() !== 'json')('set null shorthand', async () => {
    const comment = prisma.commentRequiredList.create({
      data: {
        country: 'France',
        // @ts-expect-error
        contents: null,
      },
    })

    await expect(comment).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('Argument contents for data.contents must not be null'),
      }),
    )
  })

  test('set nested list', async () => {
    const comment = await prisma.commentRequiredList.create({
      data: {
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
      {
        contents: [
          {
            text: Hello World,
            upvotes: [
              {
                userId: 10,
                vote: true,
              },
              {
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
