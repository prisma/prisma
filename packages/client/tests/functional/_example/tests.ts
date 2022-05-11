import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  // an example of how to query with the preloaded client
  test('findMany', async () => {
    await prisma.user.findMany()
  })

  // take a look at the test suite config (see _matrix.ts)
  test('suiteConfig', () => {
    console.log(suiteConfig)
  })

  // an example of how we generate the schema internally
  test('suiteSchema', async () => {
    console.log(await getTestSuiteSchema(suiteMeta, suiteConfig))
  })
})
