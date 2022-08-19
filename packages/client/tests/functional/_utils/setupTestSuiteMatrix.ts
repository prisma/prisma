import fs from 'fs-extra'
import path from 'path'

import { checkMissingProviders } from './checkMissingProviders'
import { getTestSuiteConfigs, getTestSuiteFolderPath, getTestSuiteMeta } from './getTestSuiteInfo'
import { getTestSuitePlan } from './getTestSuitePlan'
import { setupTestSuiteClient } from './setupTestSuiteClient'
import { dropTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'
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
  tests: (suiteConfig: Record<string, string>, suiteMeta: TestSuiteMeta) => void,
  options?: MatrixOptions,
) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const suiteConfigs = getTestSuiteConfigs(suiteMeta)
  const testPlan = getTestSuitePlan(suiteMeta, suiteConfigs, options)
  checkMissingProviders({
    suiteConfigs,
    suiteMeta,
    options,
  })

  for (const { name, suiteConfig, skip } of testPlan) {
    const describeFn = skip ? describe.skip : describe

    describeFn(name, () => {
      const clients = [] as any[]
      // we inject modified env vars, and make the client available as globals
      beforeAll(async () => {
        const datasourceInfo = setupTestSuiteDbURI(suiteConfig.matrixOptions)

        globalThis['datasourceInfo'] = datasourceInfo

        globalThis['loaded'] = await setupTestSuiteClient({
          suiteMeta,
          suiteConfig,
          skipDb: options?.skipDb,
          datasourceInfo,
        })

        globalThis['newPrismaClient'] = (...args) => {
          const client = new global['loaded']['PrismaClient'](...args)
          clients.push(client)
          return client
        }
        if (!options?.skipDefaultClientInstance) {
          globalThis['prisma'] = globalThis['newPrismaClient']()
        }
        globalThis['Prisma'] = (await global['loaded'])['Prisma']
      })

      // for better type dx, copy a client into the test suite root node_modules
      // this is so that we can have intellisense for the client in the test suite
      beforeAll(() => {
        const rootNodeModuleFolderPath = path.join(suiteMeta.testRoot, 'node_modules')

        // reserve the node_modules so that parallel tests suites don't conflict
        fs.mkdir(rootNodeModuleFolderPath, async (error) => {
          if (error !== null && error.code !== 'EEXIST') throw error // unknown error
          if (error !== null && error.code === 'EEXIST') return // already reserved

          const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
          const suiteNodeModuleFolderPath = path.join(suiteFolderPath, 'node_modules')

          await fs.copy(suiteNodeModuleFolderPath, rootNodeModuleFolderPath, { recursive: true })
        })
      })

      afterAll(async () => {
        for (const client of clients) {
          await client.$disconnect().catch(() => {
            // sometimes we test connection errors. In that case,
            // disconnect might also fail, so ignoring the error here
          })
        }
        clients.length = 0
        if (!options?.skipDb) {
          const datasourceInfo = globalThis['datasourceInfo']
          process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
          await dropTestSuiteDatabase(suiteMeta, suiteConfig)
        }
        process.env = originalEnv
        delete globalThis['datasourceInfo']
        delete globalThis['loaded']
        delete globalThis['prisma']
        delete globalThis['Prisma']
        delete globalThis['newPrismaClient']
      })

      tests(suiteConfig.matrixOptions, suiteMeta)
    })
  }
}

export { setupTestSuiteMatrix }
