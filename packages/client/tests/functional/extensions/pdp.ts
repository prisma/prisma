/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { randomBytes } from 'node:crypto'
import { expectTypeOf } from 'expect-type'
import https from 'node:https'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

/**
 * Tests for underlying query component features used by Prisma Accelerate
 */
testMatrix.setupTestSuite(() => {
  let mockedRequest: jest.SpyInstance<any>
  const randomId1 = randomBytes(12).toString('hex')
  const randomId2 = randomBytes(12).toString('hex')

  beforeAll(async () => {
    // this also warms up the dataproxy (schema upload)
    await prisma.user.create({
      data: {
        id: randomId1,
        email: 'john@doe.io',
        firstName: 'John',
        lastName: 'Doe',
      },
    })

    // this also warms up the dataproxy (schema upload)
    await prisma.user.create({
      data: {
        id: randomId2,
        email: 'max@mustermann.io',
        firstName: 'Max',
        lastName: 'Mustermann',
      },
    })
  })

  beforeEach(() => {
    if (typeof globalThis.fetch === 'function') {
      mockedRequest = jest.spyOn(globalThis as any, 'fetch')
    } else {
      mockedRequest = jest.spyOn(https, 'request')
    }
  })

  afterEach(() => {
    mockedRequest.mockRestore()
  })

  test('_runtimeDataModel is available on the client instance and provides model info', () => {
    const extension = Prisma.defineExtension((client) => {
      return prisma.$extends({
        model: {
          $allModels: {
            subscribe() {
              expect(client).toHaveProperty('_runtimeDataModel')
              expect((client as any)._runtimeDataModel).toHaveProperty('models')
              expect((client as any)._runtimeDataModel.models).toHaveProperty('User')
              expect((client as any)._runtimeDataModel.models.User).toHaveProperty('dbName')
              expect((client as any)._runtimeDataModel.models.User).toHaveProperty('fields')
              expect((client as any)._runtimeDataModel.models.User.fields[3]).toHaveProperty('name')
              expect((client as any)._runtimeDataModel.models.User.fields[3]).toHaveProperty('kind')
              expect((client as any)._runtimeDataModel.models.User.fields[3]).toHaveProperty('type')
              expect((client as any)._runtimeDataModel.models.User.fields[4]).toHaveProperty('relationName')
              expect((client as any)._runtimeDataModel.models.User.fields[3]).toHaveProperty('dbName')
            },
          },
        },
      })
    })

    prisma.$extends(extension).user.subscribe()
    expect.hasAssertions()
  })

  testIf(process.env.TEST_DATA_PROXY !== undefined)(
    'Prisma-Engine-Hash headers is present when sending a request',
    async () => {
      const xprisma = prisma.$extends({
        query: {
          $allModels: {
            findUnique(operation) {
              const { __internalParams, query, args } = operation as any as {
                query: (...args: any[]) => Promise<any>
                __internalParams: any
                args: any
              }

              __internalParams.customDataProxyFetch = (fetch) => {
                return async (url, options) => {
                  const res = await fetch(url, options)

                  expect(res).toHaveProperty('headers')
                  expect(res.headers.get('content-length')).toBeDefined()
                  expect(res.headers.get('Prisma-Engine-Hash')).toBeNull()

                  return res
                }
              }

              return query(args, __internalParams)
            },
          },
        },
      })

      const data = await xprisma.user.findUnique({ where: { id: randomId1 } })
      expect(data).toHaveProperty('id', randomId1)
      expect(mockedRequest.mock.calls[0][1].headers).toHaveProperty(
        'Prisma-Engine-Hash',
        '0000000000000000000000000000000000000000',
      )
    },
  )

  testIf(process.env.TEST_DATA_PROXY !== undefined)('changing http headers via custom fetch', async () => {
    const xprisma = prisma.$extends({
      query: {
        $allModels: {
          findUnique(operation) {
            const { __internalParams, query, args } = operation as any as {
              query: (...args: any[]) => Promise<any>
              __internalParams: any
              args: any
            }

            __internalParams.customDataProxyFetch = (fetch) => {
              return async (url, options) => {
                options.headers = {
                  ...options.headers,
                  'x-custom-header': 'hello',
                }

                const res = await fetch(url, options)

                expect(res).toHaveProperty('headers')
                expect(res.headers.get('content-length')).toBeDefined()

                return res
              }
            }

            return query(args, __internalParams)
          },
        },
      },
    })

    const data = await xprisma.user.findUnique({ where: { id: randomId1 } })

    expect(data).toHaveProperty('id', randomId1)

    expect(mockedRequest.mock.calls[0][1].headers).toHaveProperty('x-custom-header', 'hello')
  })

  testIf(process.env.TEST_DATA_PROXY !== undefined)(
    'confirm that custom fetch cascades like a middleware',
    async () => {
      const xprisma = prisma
        .$extends({
          query: {
            $allModels: {
              findUnique(operation) {
                const { __internalParams, query, args } = operation as any as {
                  query: (...args: any[]) => Promise<any>
                  __internalParams: any
                  args: any
                }

                __internalParams.customDataProxyFetch = (fetch) => {
                  return (url, args) => fetch(url, { ...args, order: [1] })
                }

                return query(args, __internalParams)
              },
            },
          },
        })
        .$extends({
          query: {
            $allModels: {
              findUnique(operation) {
                const { __internalParams, query, args } = operation as any as {
                  query: (...args: any[]) => Promise<any>
                  __internalParams: any
                  args: any
                }

                __internalParams.customDataProxyFetch = (fetch) => {
                  return (url, args) => fetch(url, { ...args, order: [...args.order, 2] })
                }

                return query(args, __internalParams)
              },
            },
          },
        })
        .$extends({
          query: {
            $allModels: {
              findUnique(operation) {
                const { __internalParams, query, args } = operation as any as {
                  query: (...args: any[]) => Promise<any>
                  __internalParams: any
                  args: any
                }

                __internalParams.customDataProxyFetch = (fetch) => {
                  return (url, args) => {
                    expect(args.order).toEqual([1, 2])
                    return fetch(url, args)
                  }
                }

                return query(args, __internalParams)
              },
            },
          },
        })

      const data = await xprisma.user.findUnique({ where: { id: randomId1 } }).catch()

      expect(data).toHaveProperty('id', randomId1)
    },
  )

  testIf(process.env.TEST_DATA_PROXY !== undefined)(
    'allows to override customDataProxyFetch for the whole batch',
    async () => {
      const xprisma = prisma.$extends({
        query: {
          // @ts-expect-error
          async $__internalBatch({ query, args, __internalParams }) {
            let cacheInfo: null | string = null
            __internalParams.customDataProxyFetch = (fetch) => (url, args) => {
              cacheInfo = 'hit!'
              return fetch(url, args)
            }

            const result = await query(args, __internalParams)
            for (const item of result) {
              if (item) {
                item.cacheInfo = cacheInfo
              }
            }
            return result
          },
        },
      })

      const [user1, user2] = await Promise.all([
        xprisma.user.findUnique({ where: { id: randomId1 } }),
        xprisma.user.findUnique({ where: { id: randomId2 } }),
      ])

      expect(user1).toHaveProperty('cacheInfo', 'hit!')
      expect(user2).toHaveProperty('cacheInfo', 'hit!')
    },
  )

  testIf(process.env.TEST_DATA_PROXY !== undefined)(
    'an overridden method can call its parent and the itx is respected',
    async () => {
      await prisma
        .$extends({
          model: {
            $allModels: {
              findFirst(args: any) {
                const ctx = Prisma.getExtensionContext(this)

                expectTypeOf(ctx).toHaveProperty('$parent').toEqualTypeOf<unknown | undefined>()
                expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string | undefined>()
                expectTypeOf(ctx).toHaveProperty('$name').toEqualTypeOf<string | undefined>()

                return ctx.$parent![ctx.name!].findFirst({ ...args })
              },
            },
          },
        })
        .$transaction(async (tx) => {
          await tx.user.create({
            data: {
              email: 'jane@doe.io',
              firstName: 'Jane',
              lastName: 'Doe',
            },
          })

          const data = await tx.user.findFirst({
            where: {
              email: 'jane@doe.io',
            },
            select: {
              email: true,
            },
          })

          // data is visible within the transaction
          expect(data.email).toEqual('jane@doe.io')

          throw new Error('rollback') // try rollback
        })
        .catch((e) => {
          expect(e.message).toEqual('rollback')
        })

      const users = await prisma.user.findMany()

      // default amount, rollback worked
      expect(users).toHaveLength(2)

      expect.assertions(3)
    },
  )

  testIf(process.env.TEST_DATA_PROXY !== undefined)(
    'an overridden method can call its parent and the itx with a query extension is respected',
    async () => {
      await prisma
        .$extends({
          query: {
            $allModels: {
              findFirst({ query, args }) {
                expect(args).toHaveProperty('__accelerateInfo', 'info')
                const { __accelerateInfo, ...rest } = args as any

                return query(rest)
              },
            },
          },
        })
        .$extends({
          model: {
            $allModels: {
              findFirst(args: any) {
                const ctx = Prisma.getExtensionContext(this)

                expectTypeOf(ctx).toHaveProperty('$parent').toEqualTypeOf<unknown | undefined>()
                expectTypeOf(ctx).toHaveProperty('name').toEqualTypeOf<string | undefined>()
                expectTypeOf(ctx).toHaveProperty('$name').toEqualTypeOf<string | undefined>()

                return ctx.$parent![ctx.name!].findFirst({
                  ...args,
                  __accelerateInfo: 'info',
                })
              },
            },
          },
        })
        .$transaction(async (tx) => {
          await tx.user.create({
            data: {
              email: 'jane@doe.io',
              firstName: 'Jane',
              lastName: 'Doe',
            },
          })

          const data = await tx.user.findFirst({
            where: {
              email: 'jane@doe.io',
            },
            select: {
              email: true,
            },
          })

          // data is visible within the transaction
          expect(data.email).toEqual('jane@doe.io')

          throw new Error('rollback') // try rollback
        })
        .catch((e) => {
          expect(e.message).toEqual('rollback')
        })

      const users = await prisma.user.findMany()

      // default amount, rollback worked
      expect(users).toHaveLength(2)

      expect.assertions(4)
    },
  )

  testIf(process.env.TEST_DATA_PROXY !== undefined)('customDataProxyFetch for batches stacks', async () => {
    expect.assertions(2)
    const xprisma = prisma
      .$extends({
        query: {
          // @ts-expect-error
          $__internalBatch({ query, args, __internalParams }) {
            __internalParams.customDataProxyFetch = (fetch) => (url, args) => {
              return fetch(url, { ...args, order: [1] })
            }

            return query(args, __internalParams)
          },
        },
      })
      .$extends({
        query: {
          // @ts-expect-error
          $__internalBatch({ query, args, __internalParams }) {
            __internalParams.customDataProxyFetch = (fetch) => (url, args) => {
              expect(args.order).toEqual([1])
              return fetch(url, { ...args, order: [...args.order, 2] })
            }

            return query(args, __internalParams)
          },
        },
      })
      .$extends({
        query: {
          // @ts-expect-error
          $__internalBatch({ query, args, __internalParams }) {
            __internalParams.customDataProxyFetch = (fetch) => (url, args) => {
              expect(args.order).toEqual([1, 2])
              return fetch(url, args)
            }

            return query(args, __internalParams)
          },
        },
      })

    await Promise.all([
      xprisma.user.findUnique({ where: { id: randomId1 } }),
      xprisma.user.findUnique({ where: { id: randomId2 } }),
    ])
  })
})
