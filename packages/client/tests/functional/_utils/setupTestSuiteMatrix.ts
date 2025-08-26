import events from 'node:events'

import { serve, ServerType } from '@hono/node-server'
import { afterAll, beforeAll, test } from '@jest/globals'
import { context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import * as QueryPlanExecutor from '@prisma/query-plan-executor'
import path from 'path'

import type { Client } from '../../../src/runtime/getPrismaClient'
import { checkMissingProviders } from './checkMissingProviders'
import {
  getTestSuiteClientMeta,
  getTestSuiteCliMeta,
  getTestSuiteConfigs,
  getTestSuiteFolderPath,
  getTestSuiteMeta,
} from './getTestSuiteInfo'
import { getTestSuitePlan } from './getTestSuitePlan'
import {
  getPrismaClientInternalArgs,
  setupTestSuiteClient,
  setupTestSuiteClientDriverAdapter,
} from './setupTestSuiteClient'
import { DatasourceInfo, dropTestSuiteDatabase, setupTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'
import { stopMiniProxyQueryEngine } from './stopMiniProxyQueryEngine'
import { ClientMeta, CliMeta, MatrixOptions } from './types'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>
export type TestCallbackSuiteMeta = TestSuiteMeta & { generatedFolder: string }

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
  tests: (
    suiteConfig: Record<string, string>,
    suiteMeta: TestCallbackSuiteMeta,
    clientMeta: ClientMeta,
    cliMeta: CliMeta,
    datasourceInfo: DatasourceInfo,
  ) => void,
  options?: MatrixOptions,
) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const cliMeta = getTestSuiteCliMeta()
  const suiteConfigs = getTestSuiteConfigs(suiteMeta)
  const testPlan = getTestSuitePlan(cliMeta, suiteMeta, suiteConfigs, options)

  if (originalEnv.TEST_GENERATE_ONLY === 'true') {
    options = options ?? {}
    options.skipDefaultClientInstance = true
    options.skipDb = true
  }

  checkMissingProviders({
    suiteConfigs,
    suiteMeta,
    options,
  })

  for (const { name, suiteConfig, skip } of testPlan) {
    const clientMeta = getTestSuiteClientMeta({ suiteConfig: suiteConfig.matrixOptions })
    const generatedFolder = getTestSuiteFolderPath({ suiteMeta, suiteConfig })
    const describeFn = skip ? describe.skip : describe

    let disposeWrangler: (() => Promise<void>) | undefined
    let cfWorkerBindings: Record<string, unknown> | undefined

    describeFn(name, () => {
      const clients = [] as any[]
      const datasourceInfo = setupTestSuiteDbURI({ suiteConfig: suiteConfig.matrixOptions, clientMeta })
      let server: { qpe: QueryPlanExecutor.Server; net: ServerType } | undefined

      // we inject modified env vars, and make the client available as globals
      beforeAll(async () => {
        // Set up the global context manager and the global tracer provider.
        // They are used by the query plan executor server, as well as by tracing tests.
        context.setGlobalContextManager(new AsyncLocalStorageContextManager())
        trace.setGlobalTracerProvider(new BasicTracerProvider())

        globalThis['datasourceInfo'] = datasourceInfo // keep it here before anything runs

        if (clientMeta.runtime === 'client' && clientMeta.clientEngineExecutor === 'remote') {
          const qpe = await QueryPlanExecutor.Server.create({
            databaseUrl: datasourceInfo.databaseUrl,
            maxResponseSize: QueryPlanExecutor.parseSize('128 MiB'),
            queryTimeout: QueryPlanExecutor.parseDuration('PT30S'),
            maxTransactionTimeout: QueryPlanExecutor.parseDuration('PT1M'),
            maxTransactionWaitTime: QueryPlanExecutor.parseDuration('PT1M'),
            perRequestLogContext: {
              logFormat: 'text',
              logLevel: 'warn',
            },
          })

          const hostname = '127.0.0.1'

          const net = serve({
            fetch: qpe.fetch,
            hostname,
            port: 0,
          })

          await events.once(net, 'listening')
          const address = net.address()
          if (address === null) {
            throw new Error('query plan executor server did not start')
          }
          if (typeof address === 'string') {
            throw new Error('query plan executor must be listening on TCP and not Unix socket')
          }

          server = { qpe, net }
          datasourceInfo.accelerateUrl = `prisma://${hostname}:${address.port}/?api_key=1&use_http=1`
        }

        // If using D1 Driver adapter
        // We need to setup wrangler bindings to the D1 db (using miniflare under the hood)
        if (suiteConfig.matrixOptions.driverAdapter === 'js_d1') {
          const { getPlatformProxy } = require('wrangler') as typeof import('wrangler')
          const { env, dispose } = await getPlatformProxy({
            configPath: path.join(__dirname, './wrangler.toml'),
          })

          // Expose the bindings to the test suite
          disposeWrangler = dispose
          cfWorkerBindings = env
        }

        const [clientModule, sqlModule] = await setupTestSuiteClient({
          generatorType: suiteConfig.matrixOptions.generatorType || 'prisma-client-js',
          cliMeta,
          suiteMeta,
          suiteConfig,
          datasourceInfo,
          clientMeta,
          skipDb: options?.skipDb,
          alterStatementCallback: options?.alterStatementCallback,
          cfWorkerBindings,
        })

        globalThis['loaded'] = clientModule

        const internalArgs = () =>
          getPrismaClientInternalArgs({
            suiteConfig,
            clientMeta,
          })

        const newDriverAdapter = () =>
          setupTestSuiteClientDriverAdapter({
            suiteConfig,
            clientMeta,
            datasourceInfo,
            cfWorkerBindings,
          })

        globalThis['newPrismaClient'] = (args: any) => {
          const { PrismaClient, Prisma } = clientModule

          const options = { ...internalArgs(), ...newDriverAdapter(), ...args }
          const client = new PrismaClient(options)

          globalThis['Prisma'] = Prisma
          clients.push(client)

          return client as Client
        }

        if (!options?.skipDefaultClientInstance) {
          globalThis['prisma'] = globalThis['newPrismaClient']() as Client
        }

        globalThis['Prisma'] = clientModule['Prisma']

        globalThis['sql'] = sqlModule

        globalThis['db'] = {
          setupDb: () =>
            setupTestSuiteDatabase({
              suiteMeta,
              suiteConfig,
              alterStatementCallback: options?.alterStatementCallback,
              cfWorkerBindings,
            }),
          dropDb: () => dropTestSuiteDatabase({ suiteMeta, suiteConfig, errors: [], cfWorkerBindings }).catch(() => {}),
        }
      })

      afterAll(async () => {
        if (disposeWrangler) {
          await disposeWrangler()
        }

        for (const client of clients) {
          await client.$disconnect().catch(() => {
            // sometimes we test connection errors. In that case,
            // disconnect might also fail, so ignoring the error here
          })

          if (clientMeta.dataProxy) {
            await stopMiniProxyQueryEngine({
              client: client as Client,
              datasourceInfo: globalThis['datasourceInfo'] as DatasourceInfo,
            })
          }
        }
        clients.length = 0

        if (server) {
          server.net.close()
          await server.qpe.shutdown()
          server = undefined
        }

        // CI=false: Only drop the db if not skipped, and if the db does not need to be reused.
        // CI=true always skip to save time
        if (options?.skipDb !== true && process.env.TEST_REUSE_DATABASE !== 'true' && process.env.CI !== 'true') {
          const datasourceInfo = globalThis['datasourceInfo'] as DatasourceInfo
          process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
          process.env[datasourceInfo.directEnvVarName] = datasourceInfo.databaseUrl
          await dropTestSuiteDatabase({ suiteMeta, suiteConfig, errors: [], cfWorkerBindings })
        }
        process.env = originalEnv
        delete globalThis['datasourceInfo']
        delete globalThis['loaded']
        delete globalThis['prisma']
        delete globalThis['Prisma']
        delete globalThis['sql']
        delete globalThis['newPrismaClient']
      }, 180_000)

      if (originalEnv.TEST_GENERATE_ONLY === 'true') {
        // because we have our own custom `test` global call defined that reacts
        // to this env var already, we import the original jest `test` and call
        // it because we need to run at least one test to generate the client
        test('generate only', () => {})
      }

      tests(suiteConfig.matrixOptions, { ...suiteMeta, generatedFolder }, clientMeta, cliMeta, datasourceInfo)
    })
  }
}

export { setupTestSuiteMatrix }
