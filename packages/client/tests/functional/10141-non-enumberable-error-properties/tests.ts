import { randomBytes } from 'crypto'

import { PrismaClientInitializationError, PrismaClientValidationError } from '../../../runtime'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = randomBytes(12).toString('hex')

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    test('failing connection', async () => {
      try {
        await prisma.user.create({ data: { id } })
      } catch (e) {
        expect(e instanceof PrismaClientInitializationError).toBe(true)
        expect(new Set(Object.keys(e))).toEqual(new Set(['stack', 'message', 'clientVersion', 'errorCode']))
        expect(e.clientVersion).toMatch(/^\d+\.\d+\.\d+$/)
        expect(e.errorCode).toMatch(/^P\d{4}$/) // TODO problem it is undefined
        expect(e.message).toBeTruthy()
        expect(e.stack).toBeTruthy()
      }
    })

    test('failing validation', async () => {
      try {
        await prisma.user.create({ data: { id: 1 as any as string } })
      } catch (e) {
        expect(e instanceof PrismaClientValidationError).toBe(true)
        expect(new Set(Object.keys(e))).toEqual(new Set(['stack', 'message', 'clientVersion']))
        expect(e.clientVersion).toMatch(/^\d+\.\d+\.\d+$/)
        expect(e.message).toBeTruthy()
        expect(e.stack).toBeTruthy()
      }
    })
  },
  {
    skipDb: true,
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: "This isn't influenced by a specific provider",
    },
  },
)
