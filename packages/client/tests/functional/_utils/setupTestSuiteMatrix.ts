import { getTestSuiteMeta, getTestSuiteTable, TestSuiteConfig } from './getTestSuiteInfo'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { dropTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

/**
 * How does this work from a high level? What steps?
 * 1. You create a file that uses `setupTestSuiteMatrix`
 * 2. It defines a test suite, but it is a special one
 * 3. You create a `_matrix.ts` near your test suite
 * 4. This defines the test suite matrix to be used
 * 5. You write a few tests inside your test suite
 * 7. Execute tests like you usually would with jest
 * 9. The test suite expands into many via the matrix
 * 10. Each test suite has it's own generated schema
 * 11. Each test suite has it's own database, and env
 * 12. Each test suite has it's own generated client
 * 13. Each test suite is executed with those files
 * 14. Each test suite has its environment cleaned up
 *
 * @remarks Why does each test suite have a generated schema? This is to support
 * multi-provider testing and more. A base schema is automatically injected with
 * the cross-product of the configs defined in `_matrix.ts` (@see _example).
 *
 * @remarks Generated files are used for getting the test ready for execution
 * (writing the schema, the generated client, etc...). After the test are done
 * executing, the files can easily be submitted for type checking.
 *
 * @remarks Treat `_matrix.ts` as being analogous to a github action matrix.
 *
 * @remarks Jest snapshots will work out of the box, but not inline snapshots
 * because those can't work in a loop (jest limitation). To make it work, you
 * just need to pass `-u` to jest and we do the magic to make it work.
 *
 * @param tests where you write your tests
 */
function setupTestSuiteMatrix(tests: (suiteConfig: TestSuiteConfig, suiteMeta: TestSuiteMeta) => void) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteTable = getTestSuiteTable(suiteMeta)
  const forceInlineSnapshot = process.argv.includes('-u')

  ;(forceInlineSnapshot ? [suiteTable[0]] : suiteTable).forEach((suiteEntry) => {
    const [suiteName, suiteConfig] = suiteEntry

    // we don't run tests for some providers that we want to skip on the CI
    if (suiteConfig['provider']?.toLowerCase() === 'mongodb' && process.env.TEST_SKIP_MONGODB) return
    if (suiteConfig['provider']?.toLowerCase() === 'sqlserver' && process.env.TEST_SKIP_MSSQL) return
    if (suiteConfig['provider']?.toLowerCase() === 'cockroachdb' && process.env.TEST_SKIP_COCKROACHDB) return

    describe(suiteName, () => {
      // we inject modified env vars, and make the client available as globals
      beforeAll(() => (process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }))
      beforeAll(async () => (globalThis['loaded'] = await setupTestSuiteClient(suiteMeta, suiteConfig)))
      beforeAll(
        async () =>
          (globalThis['prisma'] = new (await global['loaded'])['PrismaClient']({
            log: [
              // {
              //   level: 'query',
              //   emit: 'stdout',
              // },
            ],
          })),
      )
      beforeAll(async () => (globalThis['PrismaClient'] = (await global['loaded'])['PrismaClient']))
      beforeAll(async () => (globalThis['Prisma'] = (await global['loaded'])['Prisma']))

      // we disconnect and drop the database, clean up the env, and global vars
      afterAll(async () => await globalThis['prisma']?.$disconnect())
      afterAll(async () => await dropTestSuiteDatabase(suiteMeta, suiteConfig))
      afterAll(() => (process.env = originalEnv))
      afterAll(() => delete globalThis['loaded'])
      afterAll(() => delete globalThis['prisma'])
      afterAll(() => delete globalThis['Prisma'])
      afterAll(() => delete globalThis['PrismaClient'])

      tests(suiteConfig, suiteMeta)
    })
  })
}

export { setupTestSuiteMatrix }
