import type { D1Database } from '@cloudflare/workers-types'
import { generateClient as generateClientLegacy } from '@prisma/client-generator-js'
import { generateClient as generateClientESM } from '@prisma/client-generator-ts'
import { SqlQueryOutput } from '@prisma/generator'
import { getDMMF, inferDirectoryConfig, parseEnvValue, processSchemaResult } from '@prisma/internals'
import { readFile } from 'fs/promises'
import path from 'path'
import { fetch, WebSocket } from 'undici'

import { introspectSql } from '../../../../cli/src/generate/introspectSql'
import { PrismaClientOptions } from '../../../src/runtime/getPrismaClient'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
  testSuiteHasTypedSql,
} from './getTestSuiteInfo'
import { AdapterProviders, GeneratorTypes } from './providers'
import { DatasourceInfo, setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { AlterStatementCallback, ClientMeta, ClientRuntime, CliMeta } from './types'

const runtimeBase = path.join(__dirname, '..', '..', '..', 'runtime')

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns tuple of loaded client folder + loaded sql folder
 */
export async function setupTestSuiteClient({
  generatorType,
  cliMeta,
  suiteMeta,
  suiteConfig,
  datasourceInfo,
  clientMeta,
  skipDb,
  alterStatementCallback,
  cfWorkerBindings,
}: {
  generatorType: GeneratorTypes
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
  const schemaContext = await processSchemaResult({
    schemaResult: { schemas: [[schemaPath, schema]], schemaPath, schemaRootDir: path.dirname(schemaPath) },
    // Only TypedSQL tests strictly require env vars in the schema to resolveSome tests. (see below)
    // We also have some tests that verify error messages when env vars in the schema are not resolvable.
    // => We do not resolve env vars in the schema here and hence ignore potential errors at this point.
    ignoreEnvVarErrors: true,
  })
  const generator = schemaContext.generators.find((g) =>
    ['prisma-client-js', 'prisma-client-ts'].includes(parseEnvValue(g.provider)),
  )!
  const directoryConfig = inferDirectoryConfig(schemaContext)
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
    const schemaContextIntrospect = await processSchemaResult({
      schemaResult: { schemas: [[schemaPath, schema]], schemaPath, schemaRootDir: path.dirname(schemaPath) },
      // TypedSQL requires a connection to the database => ENV vars in the schema must be resolved for the test to work.
      ignoreEnvVarErrors: false,
    })
    typedSql = await introspectSql(directoryConfig, schemaContextIntrospect)
  }

  if (clientMeta.dataProxy === true) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.dataProxyUrl
  } else {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
  }

  const clientGenOptions = {
    datamodel: schema,
    schemaPath,
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: schemaContext.datasources,
    outputDir: path.join(suiteFolderPath, 'generated/prisma/client'),
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    testMode: true,
    activeProvider: suiteConfig.matrixOptions.provider,
    runtimeBase,
    runtimeSourcePath: path.join(__dirname, '../../../runtime'),
    copyEngine: !clientMeta.dataProxy,
    typedSql,
  }

  if (generatorType === 'prisma-client-ts') {
    await generateClientESM(clientGenOptions)
  } else {
    await generateClientLegacy(clientGenOptions)
  }

  const clientPathForRuntime: Record<ClientRuntime, { client: string; sql: string }> = {
    node: {
      client: 'generated/prisma/client',
      sql: 'generated/prisma/client/sql',
    },
    edge: {
      client: 'generated/prisma/client/edge',
      sql: 'generated/prisma/client/sql/index.edge.js',
    },
    wasm: {
      client: 'generated/prisma/client/wasm',
      sql: 'generated/prisma/client/sql/index.wasm.js',
    },
    client: {
      client: 'generated/prisma/client',
      sql: 'generated/prisma/client/sql',
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
    throw new Error(`Missing Driver Adapter`)
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
    const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')

    return {
      adapter: new PrismaPg({
        connectionString: datasourceInfo.databaseUrl,
      }),
      __internal,
    }
  }

  if (driverAdapter === AdapterProviders.JS_NEON) {
    const { neonConfig } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless')
    const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon')

    neonConfig.wsProxy = () => `127.0.0.1:5488/v1`
    neonConfig.webSocketConstructor = WebSocket
    neonConfig.useSecureWebSocket = false // disable tls
    neonConfig.pipelineConnect = false

    return {
      adapter: new PrismaNeon({
        connectionString: datasourceInfo.databaseUrl,
      }),
      __internal,
    }
  }

  if (driverAdapter === AdapterProviders.JS_PLANETSCALE) {
    const { PrismaPlanetScale } = require('@prisma/adapter-planetscale') as typeof import('@prisma/adapter-planetscale')

    const url = new URL('http://root:root@127.0.0.1:8085')
    url.pathname = new URL(datasourceInfo.databaseUrl).pathname

    return {
      adapter: new PrismaPlanetScale({
        url: url.toString(),
        fetch, // TODO remove when Node 16 is deprecated
      }),
      __internal,
    }
  }

  if (driverAdapter === AdapterProviders.JS_LIBSQL) {
    const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

    return {
      adapter: new PrismaLibSQL({
        url: datasourceInfo.databaseUrl,
        intMode: 'bigint',
      }),
      __internal,
    }
  }

  if (driverAdapter === AdapterProviders.JS_D1) {
    const { PrismaD1 } = require('@prisma/adapter-d1') as typeof import('@prisma/adapter-d1')

    const d1Client = cfWorkerBindings!.MY_DATABASE as D1Database
    return { adapter: new PrismaD1(d1Client), __internal }
  }

  throw new Error(`No Driver Adapter support for ${driverAdapter}`)
}
