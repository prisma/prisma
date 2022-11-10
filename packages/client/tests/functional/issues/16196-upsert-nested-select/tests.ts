import { randomBytes } from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = randomBytes(12).toString('hex')
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          id: id,
          email: 'john@doe.io',
          posts: {
            create: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
          },
        },
      })
    })

    test('upsert (update) with nested select many relation', async () => {
      const data = await prisma.user.upsert({
        where: { email: 'john@doe.io' },
        create: {
          email: 'john@doe.io',
        },
        update: {
          email: 'johnny@doe.io',
        },
        select: {
          posts: {
            select: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      })

      expect(data).toMatchInlineSnapshot(`
        Object {
          posts: Array [
            Object {
              user: Object {
                email: johnny@doe.io,
              },
            },
            Object {
              user: Object {
                email: johnny@doe.io,
              },
            },
            Object {
              user: Object {
                email: johnny@doe.io,
              },
            },
          ],
        }
      `)
    })

    test('upsert (update) with nested select one relation', async () => {
      const data = await prisma.user.upsert({
        where: { email: 'john@doe.io' },
        create: {
          email: 'john@doe.io',
        },
        update: {
          email: 'johnny@doe.io',
        },
        select: {
          profile: {
            select: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      })

      expect(data).toMatchInlineSnapshot(`
        Object {
          profile: null,
        }
      `)
    })

    test('upsert (create) with nested select one relation', async () => {
      const data = await prisma.user.upsert({
        where: { email: 'jane@joe.io' },
        create: {
          email: 'jane@joe.io',
        },
        update: {
          email: 'janette@doe.io',
        },
        select: {
          email: true,
          profile: {
            select: {
              id: true,
            },
          },
        },
      })

      expect(data).toMatchInlineSnapshot(`
        Object {
          email: jane@joe.io,
          profile: null,
        }
      `)
    })
  },
  {
    optOut: {
      from: ['mysql', 'mongodb', 'sqlserver'],
      reason: "We don't support native upserts for these",
    },
  },
)
