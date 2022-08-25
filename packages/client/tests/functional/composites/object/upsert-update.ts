import { faker } from '@faker-js/faker'

import { setupTestSuite } from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuite(({ contentProperty }) => {
  let id: string
  beforeEach(async () => {
    id = faker.database.mongodbObjectId()
    await prisma.comment.create({
      data: {
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
  })

  test('set', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        country: 'Mars',
        content: {
          set: {
            text: 'Goodbye World',
            upvotes: {
              vote: false,
              userId: '42',
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
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 42,
              vote: false,
            },
          ],
        },
        country: Mars,
        id: Any<String>,
      }
    `,
    )
  })

  test('set shorthand', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        country: 'Mars',
        content: {
          text: 'Goodbye World',
          upvotes: {
            vote: false,
            userId: '42',
          },
        },
      },
    })

    expect(comment).toMatchInlineSnapshot(
      { id: expect.any(String) },
      `
      Object {
        content: Object {
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 42,
              vote: false,
            },
          ],
        },
        country: Mars,
        id: Any<String>,
      }
    `,
    )
  })

  test('set null', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
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
          message: expect.stringContaining('Argument set for update.content.set must not be null'),
        }),
      )
    }
  })

  test('set null shorthand', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
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
      await expect(comment).rejects.toThrowError(
        expect.objectContaining({
          message: expect.stringContaining('Argument content for update.content must not be null'),
        }),
      )
    }
  })

  test('set nested list', async () => {
    const comment = await prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        country: 'Mars',
        content: {
          set: {
            text: 'Goodbye World',
            upvotes: [
              { userId: '10', vote: false },
              { userId: '11', vote: false },
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
          text: Goodbye World,
          upvotes: Array [
            Object {
              userId: 10,
              vote: false,
            },
            Object {
              userId: 11,
              vote: false,
            },
          ],
        },
        country: Mars,
        id: Any<String>,
      }
    `,
    )
  })

  describeIf(contentProperty === 'optional')('optional', () => {
    test('update', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                text: 'Goodbye World',
              },
              set: null,
            },
          },
        },
      })

      expect(comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
        Object {
          content: Object {
            text: Goodbye World,
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

    test('update push nested list', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                upvotes: {
                  push: [{ userId: '11', vote: true }],
                },
              },
              set: null,
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
          country: Mars,
          id: Any<String>,
        }
      `,
      )
    })

    test('update set nested list', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'optional'
            upsert: {
              update: {
                upvotes: {
                  set: [{ userId: '11', vote: true }],
                },
              },
              set: null,
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
                userId: 11,
                vote: true,
              },
            ],
          },
          country: Mars,
          id: Any<String>,
        }
      `,
      )
    })
  })

  describeIf(contentProperty === 'required')('required', () => {
    test('update', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              text: 'Goodbye World',
            },
          },
        },
      })

      expect(comment).toMatchInlineSnapshot(
        { id: expect.any(String) },
        `
        Object {
          content: Object {
            text: Goodbye World,
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

    /**
     * Update push nested list
     */
    test('update push nested list', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              upvotes: {
                push: [{ userId: '11', vote: true }],
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
              Object {
                userId: 11,
                vote: true,
              },
            ],
          },
          country: Mars,
          id: Any<String>,
        }
      `,
      )
    })

    /**
     * Update push nested list
     */
    test('update set nested list', async () => {
      const comment = await prisma.comment.upsert({
        where: { id },
        create: {
          content: {
            text: 'Hello World',
          },
        },
        update: {
          country: 'Mars',
          content: {
            // @ts-test-if: contentProperty === 'required'
            update: {
              upvotes: {
                set: [{ userId: '11', vote: true }],
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
                userId: 11,
                vote: true,
              },
            ],
          },
          country: Mars,
          id: Any<String>,
        }
      `,
      )
    })
  })

  test('unset', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
          unset: true,
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
          message: expect.stringContaining(
            'Unknown arg `unset` in update.content.unset for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })

  test('upsert set', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
          upsert: {
            update: {
              // TODO: validation error if removed
              text: 'Hello World',
            },
            set: {
              text: 'Hello World',
            },
          },
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toMatchInlineSnapshot(
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
    } else {
      await expect(comment).rejects.toThrowError(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unknown arg `upsert` in update.content.upsert for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })

  test('upsert update', async () => {
    const comment = prisma.comment.upsert({
      where: { id },
      create: {
        content: {
          text: 'Hello World',
        },
      },
      update: {
        content: {
          // @ts-test-if: contentProperty === 'optional'
          upsert: {
            update: {
              text: 'Hello World',
              upvotes: {
                push: {
                  userId: '10',
                  vote: true,
                },
              },
            },
            set: null,
          },
        },
      },
    })

    if (contentProperty === 'optional') {
      expect(await comment).toMatchInlineSnapshot(
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
    } else {
      await expect(comment).rejects.toThrowError(
        expect.objectContaining({
          message: expect.stringContaining(
            'Unknown arg `upsert` in update.content.upsert for type CommentContentUpdateEnvelopeInput',
          ),
        }),
      )
    }
  })
})
