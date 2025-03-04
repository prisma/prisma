import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

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
    skip(when, { clientRuntime }) {
      when(
        clientRuntime === 'wasm',
        `EEXIST: file already exists, symlink '/home/millsp/Work/prisma/packages/client/runtime/query-engine.wasm'
        This is a wider issue pointed out before (by @millsp) that matrixes do not always yield unique paths, can lead to many issues.
        Additionally, the test is missing an expect.assertions(1) or expect.assertions(0) depending on the case.`,
      )
    },
  },
)
