import type { D1Database } from '@cloudflare/workers-types'
import type { SqlQueryOutput } from '@prisma/generator-helper'
import { getConfig, getDMMF, parseEnvValue } from '@prisma/internals'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fetch, WebSocket } from 'undici'

import { introspectSql } from '../../../../cli/src/generate/introspectSql'
import { generateClient } from '../../../src/generation/generateClient'
import type { PrismaClientOptions } from '../../../src/runtime/getPrismaClient'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
  testSuiteHasTypedSql,
} from './getTestSuiteInfo'
import { AdapterProviders } from './providers'
import { type DatasourceInfo, setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import type { AlterStatementCallback, ClientMeta, ClientRuntime, CliMeta } from './types'

const runtimeBase = path.join(__dirname, '..', '..', '..', 'runtime')

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns tuple of loaded client folder + loaded sql folder
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
  const schemaPath = getTestSuiteSchemaPath({ suiteMeta, suiteConfig })
  const schema = getTestSuiteSchema({ cliMeta, suiteMeta, matrixOptions: suiteConfig.matrixOptions })
  const previewFeatures = getTestSuitePreviewFeatures(schema)
  const dmmf = await getDMMF({ datamodel: [[schemaPath, schema]], previewFeatures })
  const config = await getConfig({ datamodel: [[schemaPath, schema]], ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')!
  const hasTypedSql = await testSuiteHasTypedSql(suiteMeta)

  await setupTestSuiteFiles({ suiteMeta, suiteConfig })
  await setupTestSuiteSchema({ suiteMeta, suiteConfig, schema })

  process.env[datasourceInfo.directEnvVarName] = datasourceInfo.databaseUrl
  process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl

  if (skipDb !== true) {
    await setupTestSuiteDatabase({ suiteMeta, suiteConfig, alterStatementCallback, cfWorkerBindings })
  }

  let typedSql: SqlQueryOutput[] | undefined
  if (hasTypedSql) {
    typedSql = await introspectSql(schemaPath)
  }

  if (clientMeta.dataProxy === true) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.dataProxyUrl
  } else {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
  }

  await generateClient({
    datamodel: schema,
    schemaPath,
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
    typedSql,
  })

  const clientPathForRuntime: Record<ClientRuntime, { client: string; sql: string }> = {
    node: {
      client: 'node_modules/@prisma/client',
      sql: 'node_modules/@prisma/client/sql',
    },
    edge: {
      client: 'node_modules/@prisma/client/edge',
      sql: 'node_modules/@prisma/client/sql/index.edge.js',
    },
    wasm: {
      client: 'node_modules/@prisma/client/wasm',
      sql: 'node_modules/@prisma/client/sql/index.wasm.js',
    },
    client: {
      client: 'node_modules/@prisma/client',
      sql: 'node_modules/@prisma/client/sql',
    },
  }

  const clientModule = require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime].client))
  let sqlModule = undefined
  if (hasTypedSql) {
    sqlModule = require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime].sql))
  }

  return [clientModule, sqlModule]
}

/**
 * Automatically loads the driver adapter for the test suite client.
 */
export function setupTestSuiteClientDriverAdapter({
  suiteConfig,
  datasourceInfo,
  clientMeta,
  cfWorkerBindings,
}: {
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
    throw new Error('Missing Driver Adapter')
  }

  if (clientMeta.runtime === 'wasm') {
    __internal.configOverride = (config) => {
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
  } else if (clientMeta.runtime === 'client') {
    __internal.configOverride = (config) => {
      config.compilerWasm = {
        getRuntime: () => require(path.join(runtimeBase, `query_compiler_bg.${provider}.js`)),
        getQueryCompilerWasmModule: async () => {
          const queryCompilerWasmFilePath = path.join(runtimeBase, `query_compiler_bg.${provider}.wasm`)
          const queryCompilerWasmFileBytes = await readFile(queryCompilerWasmFilePath)

          return new globalThis.WebAssembly.Module(queryCompilerWasmFileBytes)
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

    neonConfig.wsProxy = () => '127.0.0.1:5488/v1'
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
    return { adapter: new PrismaD1(d1Client), __internal }
  }

  throw new Error(`No Driver Adapter support for ${driverAdapter}`)
}
