import { getTestSuiteSchema } from '../_utils/getTestSuiteInfo'
import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix((suiteConfig, suiteMeta) => {
  // config (cross-product of _matrix.ts)
  test('suiteConfig', () => {
    console.log(suiteConfig)
  })

  // an example of how to get the schema
  test('suiteSchema', async () => {
    console.log(await getTestSuiteSchema(suiteMeta, suiteConfig))
  })

  // an example of how to make a query
  test('findMany', async () => {
    await prisma.user.findMany()
  })
})
