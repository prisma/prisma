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
  let mockedRequest: jest.Mock
  const originalRequest = https.request
  const randomId = randomBytes(12).toString('hex')

  beforeEach(() => {
    mockedRequest = jest.fn()
    https.request = (...args: any[]) => {
      mockedRequest(args[0], args[1], args[2])
      return originalRequest(args[0], args[1], args[2])
    }
  })

  afterEach(() => {
    https.request = originalRequest
  })

  testIf(process.env.DATA_PROXY !== undefined)('changing http headers via headers property', async () => {
    const xprisma = prisma.$extends({
      query: {
        $allModels: {
          findUnique(operation) {
            const { __internalParams, query, args } = operation as any as {
              query: (...args: any[]) => Promise<any>
              __internalParams: any
              args: any
            }

            __internalParams.headers = {
              ...__internalParams.headers,
              'x-custom-header': 'hello',
            }

            return query(args, __internalParams)
          },
        },
      },
    })

    const data = await xprisma.user.findUnique({ where: { id: randomId } })

    expect(data).toBe(null)
    // for the first call, the data proxy client will do some additional requests that aren't relevant
    expect(mockedRequest.mock.calls[0][1].headers).not.toHaveProperty('x-custom-header') // checks version
    expect(mockedRequest.mock.calls[1][1].headers).toHaveProperty('x-custom-header') // tries to send query
    expect(mockedRequest.mock.calls[2][1].headers).not.toHaveProperty('x-custom-header') // uploads schema
    expect(mockedRequest.mock.calls[3][1].headers).toHaveProperty('x-custom-header', 'hello') // sends query
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

            __internalParams.customFetch = (fetch) => {
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

    expect(data).toBe(null)

    expect(mockedRequest.mock.calls[0][1].headers).toHaveProperty('x-custom-header', 'hello')
  })
})
