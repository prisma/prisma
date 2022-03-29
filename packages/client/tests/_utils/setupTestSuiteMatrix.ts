import path from 'path'

import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuiteTable } from './getTestSuiteInfo'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { setupTestSuiteDbURI } from './setupTestSuiteEnv'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

function setupTestSuiteMatrix(tests: (suiteConfig: TestSuiteConfig, suiteMeta: TestSuiteMeta) => void) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteTable = getTestSuiteTable(suiteMeta)

  describe.each(suiteTable)('%s', (_, suiteConfig) => {
    beforeAll(() => (process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }))
    beforeAll(async () => (globalThis['loaded'] = await setupTestSuiteClient(suiteMeta, suiteConfig)))
    beforeAll(async () => (globalThis['prisma'] = new (await global['import'])['PrismaClient']()))
    afterAll(async () => await globalThis['prisma']?.disconnect())
    afterAll(() => (process.env = originalEnv))

    tests(suiteConfig, suiteMeta)
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
