import { EventEmitter } from 'events'

import { wait } from '../../_utils/tests/wait'
import { waitFor } from '../../_utils/tests/waitFor'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      if ((await prisma.user.findFirst()) === null) {
        await prisma.user.create({
          data: {
            email: 'jane@doe.io',
            firstName: 'Jane',
            lastName: 'Doe',
          },
        })
      }
    })

    test('extending a specific model query', async () => {
      const fnUser = jest.fn()
      const fnPost = jest.fn()
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma.$extends({
        query: {
          user: {
            findFirst({ args, query, operation, model }) {
              fnUser({ args, operation, model })
              return query(args)
            },
          },
          post: {
            findFirst({ args, query, operation, model }) {
              fnPost({ args, operation, model })
              return query(args)
            },
          },
        },
      })

      const args = { where: { id: '1' } }
      const cbArgs = { args, operation: 'findFirst', model: 'User' }

      const data = await xprisma.user.findFirst(args)

      expect(data).toMatchInlineSnapshot(`null`)
      expect(fnUser).toHaveBeenCalledWith(cbArgs)
      expect(fnUser).toHaveBeenCalledTimes(1)
      expect(fnPost).not.toHaveBeenCalled()
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('top to bottom execution order', async () => {
      let i = 0
      const fnUser1 = jest.fn()
      const fnUser2 = jest.fn()
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser1(++i)
                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser2(++i)
                return query(args)
              },
            },
          },
        })

      const args = { where: { id: '1' } }

      const data = await xprisma.user.findFirst(args)

      expect(data).toMatchInlineSnapshot(`null`)
      expect(fnUser1).toHaveBeenCalledWith(1)
      expect(fnUser1).toHaveBeenCalledTimes(1)
      expect(fnUser2).toHaveBeenCalledWith(2)
      expect(fnUser2).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('args mutation isolation', async () => {
      const fnEmitter = jest.fn()
      const fnUser = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                args.where = { id: '1' }

                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                args.where = { id: '2' }

                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser(args)

                return query(args)
              },
            },
          },
        })

      const args = { where: { id: '0' } }

      const data = await xprisma.user.findFirst(args)

      expect(data).toMatchInlineSnapshot(`null`)
      expect(args).toEqual({ where: { id: '0' } })
      expect(fnUser).toHaveBeenCalledWith({ where: { id: '2' } })
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('args mutation accumulation', async () => {
      const fnUser = jest.fn()
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                args.where = { id: '1', ...args.where }

                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                args.where = { email: 'john@doe.io', ...args.where }

                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser(args)

                return query(args)
              },
            },
          },
        })

      const data = await xprisma.user.findFirst({ skip: 1 })

      expect(data).toMatchInlineSnapshot(`null`)
      expect(fnUser).toHaveBeenCalledWith({ where: { id: '1', email: 'john@doe.io' }, skip: 1 })
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('query result override with a simple call', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma.$extends({
        query: {
          user: {
            // @ts-expect-error
            findFirst() {
              return 1 // override
            },
          },
        },
      })

      const data = await xprisma.user.findFirst({ skip: 1 })

      expect(data).toBe(1)
      await wait(() => expect(fnEmitter).not.toHaveBeenCalled())
    })

    test('query result override with extra extension after', async () => {
      const fnEmitter = jest.fn()
      const fnUser = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              // @ts-expect-error
              findFirst() {
                return 1 // override
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser(args)

                return query(args)
              },
            },
          },
        })

      const data = await xprisma.user.findFirst({ skip: 1 })

      expect(data).toBe(1)
      expect(fnUser).not.toHaveBeenCalled()
      await wait(() => expect(fnEmitter).not.toHaveBeenCalled())
    })

    test('query result override with extra extension before', async () => {
      const fnEmitter = jest.fn()
      const fnUser = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              findFirst({ args, query, operation, model }) {
                fnUser(args)

                return query(args)
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              // @ts-expect-error
              findFirst() {
                return 1 // override
              },
            },
          },
        })

      const data = await xprisma.user.findFirst({ skip: 1 })

      expect(data).toBe(1)
      expect(fnUser).toHaveBeenCalledWith({ skip: 1 })
      await wait(() => expect(fnEmitter).not.toHaveBeenCalled())
    })

    test('query result mutation with a simple call', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma.$extends({
        query: {
          user: {
            async findFirst({ args, query, operation, model }) {
              const data = await query(args)

              data.id = '<redacted>'

              return data
            },
          },
        },
      })

      const data = await xprisma.user.findFirst()

      expect(data).toMatchInlineSnapshot(`
        Object {
          email: jane@doe.io,
          firstName: Jane,
          id: <redacted>,
          lastName: Doe,
        }
      `)
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('query result mutation with multiple calls', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.id = '<redacted>'

                return data
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.email = '<redacted>'

                return data
              },
            },
          },
        })

      const data = await xprisma.user.findFirst()

      expect(data).toMatchInlineSnapshot(`
        Object {
          email: <redacted>,
          firstName: Jane,
          id: <redacted>,
          lastName: Doe,
        }
      `)
      await waitFor(() => expect(fnEmitter).toHaveBeenCalledTimes(1))
    })

    test('query result mutations with batch transactions', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.id = '<redacted>'

                return data
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.email = '<redacted>'

                return data
              },
            },
          },
        })

      const data = await xprisma.$transaction([xprisma.user.findFirst(), xprisma.post.findFirst()])

      expect(data).toMatchInlineSnapshot(`
        Array [
          Object {
            email: <redacted>,
            firstName: Jane,
            id: <redacted>,
            lastName: Doe,
          },
          null,
        ]
      `)
      await waitFor(() => {
        expect(fnEmitter).toHaveBeenCalledTimes(4)
        expect(fnEmitter.mock.calls).toMatchObject([
          [{ query: expect.stringContaining('BEGIN') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('COMMIT') }],
        ])
      })
    })

    test('transforming a simple query into a batch transaction', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma.$extends({
        query: {
          user: {
            async findFirst({ args, query, operation, model }) {
              return (await prisma.$transaction([prisma.$queryRaw`SELECT 1`, query(args)]))[1]
            },
          },
        },
      })

      const data = await xprisma.user.findFirst({
        select: {
          lastName: true,
        },
      })

      expect(data).toMatchInlineSnapshot(`
        Object {
          lastName: Doe,
        }
      `)
      await waitFor(() => {
        expect(fnEmitter).toHaveBeenCalledTimes(4)
        expect(fnEmitter.mock.calls).toMatchObject([
          [{ query: expect.stringContaining('BEGIN') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('COMMIT') }],
        ])
      })
    })

    test('hijacking a batch transaction into another one with a simple call', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma.$extends({
        query: {
          user: {
            async findFirst({ args, query, operation, model }) {
              return (await prisma.$transaction([prisma.$queryRaw`SELECT 1`, query(args)]))[1]
            },
          },
        },
      })

      const data = await xprisma.$transaction([
        xprisma.user.findFirst({
          select: {
            lastName: true,
          },
        }),
        xprisma.post.findFirst(),
      ])

      expect(data).toMatchInlineSnapshot(`
        Array [
          Object {
            lastName: Doe,
          },
          null,
        ]
      `)
      await waitFor(() => {
        // user.findFirst 4 queries + post.findFirst 1 query
        expect(fnEmitter).toHaveBeenCalledTimes(5)
        const calls = [...fnEmitter.mock.calls]

        // get rid of dandling post.findFirst query
        if (calls[0][0]['query'].includes('SELECT')) {
          calls.shift()
        } else {
          calls.pop()
        }

        expect(calls).toMatchObject([
          [{ query: expect.stringContaining('BEGIN') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('COMMIT') }],
        ])
      })
    })

    test('hijacking a batch transaction into another one with multiple calls', async () => {
      const fnEmitter = jest.fn()

      prisma.$on('query', fnEmitter)

      const xprisma = prisma
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.firstName = '<redacted>'

                return data
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                return (await prisma.$transaction([prisma.$queryRaw`SELECT 1`, query(args)]))[1]
              },
            },
          },
        })
        .$extends({
          query: {
            user: {
              async findFirst({ args, query, operation, model }) {
                const data = await query(args)

                data.lastName = '<redacted>'

                return data
              },
            },
          },
        })

      const data = await xprisma.$transaction([
        xprisma.user.findFirst({
          select: {
            firstName: true,
            lastName: true,
          },
        }),
        xprisma.post.findFirst(),
      ])

      expect(data).toMatchInlineSnapshot(`
        Array [
          Object {
            firstName: <redacted>,
            lastName: <redacted>,
          },
          null,
        ]
      `)

      await waitFor(() => {
        // user.findFirst 4 queries + post.findFirst 1 query
        expect(fnEmitter).toHaveBeenCalledTimes(5)
        const calls = [...fnEmitter.mock.calls]

        // get rid of dandling post.findFirst query
        if (calls[0][0]['query'].includes('SELECT')) {
          calls.shift()
        } else {
          calls.pop()
        }

        expect(calls).toMatchObject([
          [{ query: expect.stringContaining('BEGIN') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('SELECT') }],
          [{ query: expect.stringContaining('COMMIT') }],
        ])
      })
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
