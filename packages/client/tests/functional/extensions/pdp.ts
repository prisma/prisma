import { randomBytes } from 'crypto'
import https from 'https'

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
  const originalRequest = https.request
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
    mockedRequest = jest.spyOn(https, 'request')
  })

  afterEach(() => {
    https.request = originalRequest
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
              expect((client as any)._runtimeDataModel.models.User).toHaveProperty('fields')
            },
          },
        },
      })
    })

    prisma.$extends(extension).user.subscribe()
    expect.hasAssertions()
  })

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
                expect(res.headers).toHaveProperty('content-length')

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
    'an overridden method can call its own name without causing a stack overflow',
    // (calls its parent implementation instead, only works for builtin methods)
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
              findFirst(this: any, args: any) {
                // before, this used to cause a stack overflow because it would
                // call itself, but now it calls the parent implementation
                return this.findFirst({
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
            select: {
              email: true,
            },
          })

          // data is visible within the transaction
          expect(data.email).toEqual('john@doe.io')

          throw new Error('rollback') // try rollback
        })
        .catch(() => {})

      const users = await prisma.user.findMany()

      // default amount, rollback worked
      expect(users).toHaveLength(2)

      expect.assertions(3)
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
