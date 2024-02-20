import type { D1Database } from '@cloudflare/workers-types'
import { getConfig, getDMMF, parseEnvValue, serializeSchemaToBytes } from '@prisma/internals'
import { readFile } from 'fs/promises'
import path from 'path'
import { fetch, WebSocket } from 'undici'

import { generateClient } from '../../../src/generation/generateClient'
import { PrismaClientOptions } from '../../../src/runtime/getPrismaClient'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
} from './getTestSuiteInfo'
import { AdapterProviders } from './providers'
import { DatasourceInfo, setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { AlterStatementCallback, ClientMeta, ClientRuntime, CliMeta } from './types'

const runtimeBase = path.join(__dirname, '..', '..', '..', 'runtime')

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns loaded client module
 */
export async function setupTestSuiteClient({
  cliMeta,
  suiteMeta,
  suiteConfig,
  datasourceInfo,
  clientMeta,
  skipDb,
  alterStatementCallback,
  cfWorkerBindings,
}: {
  cliMeta: CliMeta
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  skipDb?: boolean
  alterStatementCallback?: AlterStatementCallback
  cfWorkerBindings?: Record<string, unknown>
}) {
  const suiteFolderPath = getTestSuiteFolderPath({ suiteMeta, suiteConfig })
  const schema = getTestSuiteSchema({ cliMeta, suiteMeta, matrixOptions: suiteConfig.matrixOptions })
  const previewFeatures = getTestSuitePreviewFeatures(schema)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')!

  await setupTestSuiteFiles({ suiteMeta, suiteConfig })
  await setupTestSuiteSchema({ suiteMeta, suiteConfig, schema })

  process.env[datasourceInfo.directEnvVarName] = datasourceInfo.databaseUrl
  process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl

  if (skipDb !== true) {
    await setupTestSuiteDatabase({ suiteMeta, suiteConfig, alterStatementCallback, cfWorkerBindings })
  }

  if (clientMeta.dataProxy === true) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.dataProxyUrl
  } else {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
  }

  await generateClient({
    datamodel: schema,
    schemaPath: getTestSuiteSchemaPath({ suiteMeta, suiteConfig }),
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: config.datasources,
    outputDir: path.join(suiteFolderPath, 'node_modules/@prisma/client'),
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    testMode: true,
    activeProvider: suiteConfig.matrixOptions.provider,
    runtimeBase: runtimeBase,
    copyEngine: !clientMeta.dataProxy,
  })

  const clientPathForRuntime: Record<ClientRuntime, string> = {
    node: 'node_modules/@prisma/client',
    edge: 'node_modules/@prisma/client/edge',
    wasm: 'node_modules/@prisma/client/wasm',
  }

  return require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime]))
}

/**
 * Automatically loads the driver adapter for the test suite client.
 */
export async function setupTestSuiteClientDriverAdapter({
  suiteMeta,
  suiteConfig,
  datasourceInfo,
  clientMeta,
  cfWorkerBindings,
}: {
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  cfWorkerBindings?: Record<string, unknown>
}) {
  const driverAdapter = suiteConfig.matrixOptions.driverAdapter
  const provider = suiteConfig.matrixOptions.provider
  const __internal: PrismaClientOptions['__internal'] = {}

  if (clientMeta.driverAdapter !== true) return {}

  if (driverAdapter === undefined) {
    throw new Error(`Missing Driver Adapter`)
  }

  const datamodelPath = getTestSuiteSchemaPath(suiteMeta, suiteConfig)
  const datamodel = await readFile(datamodelPath, 'utf-8')
  const serializedSchema = serializeSchemaToBytes({ datamodel, datamodelPath })

  if (clientMeta.runtime === 'wasm') {
    __internal.configOverride = (config) => {
      config.serializedSchema = serializedSchema
      config.engineWasm = {
        getRuntime: () => require(path.join(runtimeBase, `query_engine_bg.${provider}.js`)),
        getQueryEngineWasmModule: async () => {
          const queryEngineWasmFilePath = path.join(runtimeBase, `query_engine_bg.${provider}.wasm`)
          const queryEngineWasmFileBytes = await readFile(queryEngineWasmFilePath)

          return new globalThis.WebAssembly.Module(queryEngineWasmFileBytes)
        },
      }
      return config
    }
  }

  if (driverAdapter === AdapterProviders.JS_PG) {
    const { Pool } = require('pg') as typeof import('pg')
    const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')

    const pool = new Pool({
      connectionString: datasourceInfo.databaseUrl,
    })

    return { adapter: new PrismaPg(pool), __internal }
  }

  if (driverAdapter === AdapterProviders.JS_NEON) {
    const { neonConfig, Pool } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless')
    const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon')

    neonConfig.wsProxy = () => `127.0.0.1:5488/v1`
    neonConfig.webSocketConstructor = WebSocket
    neonConfig.useSecureWebSocket = false // disable tls
    neonConfig.pipelineConnect = false

    const pool = new Pool({
      connectionString: datasourceInfo.databaseUrl,
    })

    return { adapter: new PrismaNeon(pool), __internal }
  }

  if (driverAdapter === AdapterProviders.JS_PLANETSCALE) {
    const { Client } = require('@planetscale/database') as typeof import('@planetscale/database')
    const { PrismaPlanetScale } = require('@prisma/adapter-planetscale') as typeof import('@prisma/adapter-planetscale')

    const url = new URL('http://root:root@127.0.0.1:8085')
    url.pathname = new URL(datasourceInfo.databaseUrl).pathname

    const client = new Client({
      url: url.toString(),
      fetch, // TODO remove when Node 16 is deprecated
    })

    return { adapter: new PrismaPlanetScale(client), __internal }
  }

  if (driverAdapter === AdapterProviders.JS_LIBSQL) {
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client')
    const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

    const client = createClient({
      url: datasourceInfo.databaseUrl,
      intMode: 'bigint',
    })

    return { adapter: new PrismaLibSQL(client), __internal }
  }

  if (driverAdapter === AdapterProviders.JS_D1) {
    const { PrismaD1 } = require('@prisma/adapter-d1') as typeof import('@prisma/adapter-d1')

    const d1Client = cfWorkerBindings!.MY_DATABASE as D1Database
    return { adapter: new PrismaD1(d1Client, process.env.DEBUG), __internal }
  }

  throw new Error(`No Driver Adapter support for ${driverAdapter}`)
}
