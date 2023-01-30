import { randomBytes } from 'crypto'
import https from 'https'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const prisma: PrismaClient

/**
 * Tests for underlying query component features used by Prisma Accelerate
 */
testMatrix.setupTestSuite(() => {
  let mockedRequest: jest.SpyInstance<any>
  const originalRequest = https.request
  const randomId = randomBytes(12).toString('hex')

  beforeAll(async () => {
    // this also warms up the dataproxy (schema upload)
    await prisma.user.create({
      data: {
        id: randomId,
        email: 'john@doe.io',
        firstName: 'John',
        lastName: 'Doe',
      },
    })
  })

  beforeEach(() => {
    mockedRequest = jest.spyOn(https, 'request')
  })

  afterEach(() => {
    https.request = originalRequest
  })

  testIf(process.env.DATA_PROXY !== undefined)('changing http headers via custom fetch', async () => {
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

    const data = await xprisma.user.findUnique({ where: { id: randomId } })

    expect(data).toHaveProperty('id', randomId)

    expect(mockedRequest.mock.calls[0][1].headers).toHaveProperty('x-custom-header', 'hello')
  })

  testIf(process.env.DATA_PROXY !== undefined)('confirm that custom fetch cascades like a middleware', async () => {
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

    const data = await xprisma.user.findUnique({ where: { id: randomId } }).catch()

    expect(data).toHaveProperty('id', randomId)
  })
})
