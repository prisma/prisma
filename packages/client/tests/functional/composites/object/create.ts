import { getQueryEngineProtocol } from '@prisma/internals'

import { setupTestSuite } from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

setupTestSuite(({ contentProperty }) => {
  test('set', async () => {
    const comment = await prisma.comment.create({
      data: {
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
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('set shorthand', async () => {
    const comment = await prisma.comment.create({
      data: {
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
        country: France,
        id: Any<String>,
      }
    `,
    )
  })

  test('set null', async () => {
    const comment = prisma.comment.create({
      data: {
        country: 'France',
        content: {
          // @ts-test-if: contentProperty === 'optional'
          set: null,
        },
      },
    })

    if (contentProperty === 'required') {
      if (getQueryEngineProtocol() === 'graphql') {
        await expect(comment).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('Argument set for data.content.set must not be null'),
          }),
        )
      }
    } else {
      expect(await comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
              {
                content: null,
                country: France,
                id: Any<String>,
              }
            `,
      )
    }
  })

  test('set null shorthand', async () => {
    const comment = prisma.comment.create({
      data: {
        country: 'France',
        // @ts-test-if: contentProperty === 'optional'
        content: null,
      },
    })

    if (contentProperty === 'required') {
      if (getQueryEngineProtocol() === 'graphql') {
        await expect(comment).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining('Got invalid value null on prisma.createOneComment'),
          }),
        )
      }
    } else {
      expect(await comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
              {
                content: null,
                country: France,
                id: Any<String>,
              }
            `,
      )
    }
  })

  test('set nested list', async () => {
    const comment = await prisma.comment.create({
      data: {
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
      {
        content: {
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
        country: France,
        id: Any<String>,
      }
    `,
    )
  })
})
