import { randomBytes } from 'crypto'
import https from 'https'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare const prisma: PrismaClient

const randomId1 = randomBytes(12).toString('hex')

const originalRequest = https.request
testMatrix.setupTestSuite(() => {
  const mockedRequest = jest.fn()

  beforeAll(() => {
    https.request = (...args: any[]) => {
      mockedRequest(args[0], args[1], args[2])
      return originalRequest(args[0], args[1], args[2])
    }
  })

  afterAll(() => {
    https.request = originalRequest
  })

  testIf(process.env.DATA_PROXY !== undefined)('changing http headers', async () => {
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

    await xprisma.user.findUnique({ where: { id: randomId1 } })

    expect(mockedRequest.mock.calls[0][1].headers).not.toHaveProperty('x-custom-header')
    expect(mockedRequest.mock.calls[1][1].headers).toHaveProperty('x-custom-header')
    expect(mockedRequest.mock.calls[2][1].headers).not.toHaveProperty('x-custom-header')
    expect(mockedRequest.mock.calls[3][1].headers).toHaveProperty('x-custom-header', 'hello')
  })
})
