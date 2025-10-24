import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    test('an error is thrown when using accelerate with metrics', () => {
      try {
        newPrismaClient()
      } catch (e) {
        expect(e.message).toMatchInlineSnapshot(`
          "The \`metrics\` preview feature is not yet available with Accelerate.
          Please remove \`metrics\` from the \`previewFeatures\` in your schema.

          More information about Accelerate: https://pris.ly/d/accelerate"
        `)
      }
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This does not depend on a particular provider',
    },
    skipDefaultClientInstance: true,
  },
)
