import { setupTestSuiteMatrix } from '../../_utils/setupTestSuiteMatrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

setupTestSuiteMatrix(() => {
  test('simpleInput1', async () => console.log(await prisma.user.findMany()))
})
