import path from 'path'

import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteTable } from './getTestSuiteInfo'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { setupTestSuiteDbURI } from './setupTestSuiteEnv'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

function setupTestSuiteMatrix<Prisma, PrismaClient>(
  tests: (
    importClient: () => Promise<any>,
    prisma: PrismaClient,
    Prisma: Prisma,
    suiteMeta: TestSuiteMeta,
    suiteConfig: TestSuiteConfig,
  ) => void,
) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteTable = getTestSuiteTable(suiteMeta)
  const dummyEmptyValue = undefined as never

  describe.each(suiteTable)('%s', (_, suiteConfig) => {
    beforeAll(() => (process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }))
    afterAll(() => (process.env = originalEnv))

    const importClient = () => setupTestSuiteClient(suiteMeta, suiteConfig)
    tests(importClient, dummyEmptyValue, dummyEmptyValue, suiteMeta, suiteConfig)
  })
}

function getTestSuiteMeta() {
  const testPath = expect.getState().testPath
  const testDir = path.dirname(testPath)
  const suiteName = path.basename(path.basename(testDir))
  const matrixPath = path.join(testDir, '_matrix')
  const prismaPath = path.join(testDir, 'prisma')

  return { testPath, testDir, suiteName, matrixPath, prismaPath }
}

export { setupTestSuiteMatrix }
