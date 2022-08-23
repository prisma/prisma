// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const TIMEOUT = 60_000

testMatrix.setupTestSuite(() => {
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

      expect(warnings.join('')).toContain('There are already 10 instances of Prisma Client actively running')
    },
    TIMEOUT,
  )
})
