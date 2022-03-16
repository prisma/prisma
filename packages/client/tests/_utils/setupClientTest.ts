import path from 'path'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { C } from 'ts-toolbelt'

import { getInMemoryClient } from './getInMemoryClient'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteTable } from './getTestSuiteInfo'
import { setupTestSuiteDbURI } from './setupTestSuiteEnv'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

function setupClientTest<C extends C.Class>(
  tests: (
    prisma: C.Instance<C>,
    getClient: (options: C.Parameters<C>[0]) => any,
    suiteMeta: TestSuiteMeta,
    suiteConfig: TestSuiteConfig,
  ) => void,
) {
  const originalEnv = process.env
  const testSuiteMeta = getTestSuiteMeta()
  const testSuiteTable = getTestSuiteTable(testSuiteMeta)

  describe.each(testSuiteTable)('%s', (_, suiteConfig) => {
    beforeAll(() => (process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }))
    afterAll(() => (process.env = originalEnv))

    tests(undefined as never, newPrismaClient(testSuiteMeta, suiteConfig), testSuiteMeta, suiteConfig)
  })
}

const newPrismaClient =
  (suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) =>
  async <C extends C.Class>(options: C.Parameters<C>[0]) => {
    const PrismaClient = await getInMemoryClient(suiteMeta, suiteConfig)
    const prisma = new PrismaClient(options) as C.Instance<C>

    await (prisma as any).$connect()

    return prisma
  }

function getTestSuiteMeta() {
  const testPath = expect.getState().testPath
  const testDir = path.dirname(testPath)
  const suiteName = path.basename(path.basename(testDir))
  const matrixPath = path.join(testDir, '_matrix')
  const prismaPath = path.join(testDir, 'prisma')

  return { testPath, testDir, suiteName, matrixPath, prismaPath }
}

export { setupClientTest }
