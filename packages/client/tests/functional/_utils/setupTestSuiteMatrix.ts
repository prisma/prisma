import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'

import { checkMissingProviders } from './checkMissingProviders'
import { getTestSuiteConfigs, getTestSuiteMeta, TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuitePlan } from './getTestSuitePlan'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { dropTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'
import { setupTracing } from './setupTracing'
import { MatrixOptions } from './types'

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
function setupTestSuiteMatrix(
  tests: (suiteConfig: TestSuiteConfig, suiteMeta: TestSuiteMeta, tracer: InMemorySpanExporter) => void,
  options?: MatrixOptions,
) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteConfig = getTestSuiteConfigs(suiteMeta)
  const testPlan = getTestSuitePlan(suiteMeta, suiteConfig)
  checkMissingProviders({
    suiteConfig,
    suiteMeta,
    options,
  })

  // Tracing to happen top level because many different instances of OTEL will conflict(using global vars)
  const inMemorySpanExporter = setupTracing()

  for (const { name, suiteConfig, skip } of testPlan) {
    const describeFn = skip ? describe.skip : describe

    describeFn(name, () => {
      // we inject modified env vars, and make the client available as globals
      beforeAll(async () => {
        process.env = { ...setupTestSuiteDbURI(suiteConfig), ...originalEnv }

        globalThis['loaded'] = await setupTestSuiteClient({
          suiteMeta,
          suiteConfig,
          skipDb: options?.skipDb,
        })

        globalThis['prisma'] = new (await global['loaded'])['PrismaClient']()
        globalThis['PrismaClient'] = (await global['loaded'])['PrismaClient']
        globalThis['Prisma'] = (await global['loaded'])['Prisma']
      })

      afterAll(async () => {
        !options?.skipDb && (await globalThis['prisma']?.$disconnect())
        !options?.skipDb && (await dropTestSuiteDatabase(suiteMeta, suiteConfig))
        process.env = originalEnv
        delete globalThis['loaded']
        delete globalThis['prisma']
        delete globalThis['Prisma']
        delete globalThis['PrismaClient']
      })

      tests(suiteConfig, suiteMeta, inMemorySpanExporter)
    })
  }
}

export { setupTestSuiteMatrix }
