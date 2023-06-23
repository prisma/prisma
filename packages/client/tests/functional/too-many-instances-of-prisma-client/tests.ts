// @ts-ignore
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const TIMEOUT = 60_000

testMatrix.setupTestSuite(
  () => {
    const oldConsoleWarn = console.warn
    const warnings: any[] = []

    beforeAll(() => {
      jest.resetModules()

      console.warn = (args) => {
        warnings.push(args)
      }
    })

    afterAll(() => {
      console.warn = oldConsoleWarn
    })

    test(
      'should console warn when spawning too many instances of PrismaClient',
      async () => {
        for (let i = 0; i < 15; i++) {
          const client = newPrismaClient()
          await client.$connect()
        }

        expect(warnings.join('')).toContain('This is the 10th instance of Prisma Client being started. Make sure this is intentional.')
      },
      TIMEOUT,
    )
  },
  {
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: '"Too many instances" warning is not implemented for Data Proxy client',
    },
  },
)
