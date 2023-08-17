import stripAnsi from 'strip-ansi'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    test('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient()

      try {
        await prisma.$connect()
      } catch (e) {
        const message = stripAnsi(e.message as string)
        expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
        expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
      }
    })

    test('PrismaClientInitializationError for missing env and empty override', async () => {
      const prisma = newPrismaClient({
        datasources: {
          db: {},
        },
      })

      try {
        await prisma.$connect()
      } catch (e) {
        const message = stripAnsi(e.message as string)
        expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
        expect(message).toContain('error: Environment variable not found: DATABASE_URI.')
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
