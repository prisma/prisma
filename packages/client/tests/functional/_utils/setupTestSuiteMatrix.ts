import path from 'path'

import { getTestSuiteMeta, getTestSuiteTable, TestSuiteConfig } from './getTestSuiteInfo'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { dropTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

function setupTestSuiteMatrix(tests: (suiteConfig: TestSuiteConfig, suiteMeta: TestSuiteMeta) => void) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteTable = getTestSuiteTable(suiteMeta)

  describe.each(suiteTable)('%s', (_, suiteConfig) => {
    beforeAll(() => (process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }))
    beforeAll(async () => (globalThis['loaded'] = await setupTestSuiteClient(suiteMeta, suiteConfig)))
    beforeAll(async () => (globalThis['prisma'] = new (await global['loaded'])['PrismaClient']()))

    afterAll(async () => await globalThis['prisma']?.$disconnect())
    afterAll(async () => await dropTestSuiteDatabase(suiteMeta, suiteConfig))
    afterAll(() => (process.env = originalEnv))
    afterAll(() => delete globalThis['loaded'])
    afterAll(() => delete globalThis['prisma'])

    tests(suiteConfig, suiteMeta)
  })
}

export { setupTestSuiteMatrix }
