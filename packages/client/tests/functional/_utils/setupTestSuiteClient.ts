import type { D1Database } from '@cloudflare/workers-types'
import {
  generateClient as generateClientLegacy,
  type GenerateClientOptions as GenerateClientLegacyOptions,
} from '@prisma/client-generator-js'
import {
  generateClient as generateClientESM,
  type GenerateClientOptions as GenerateClientESMOptions,
} from '@prisma/client-generator-ts'
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
  const outputPath = generatorType === 'prisma-client-ts' ? 'generated/prisma' : 'generated/prisma/client'

  const clientGenOptions: GenerateClientLegacyOptions & GenerateClientESMOptions = {
    datamodel: schema,
    schemaPath,
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: schemaContext.datasources,
    outputDir: path.join(suiteFolderPath, outputPath),
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
    target: 'nodejs',
    generatedFileExtension: 'ts',
    importFileExtension: '',
    moduleFormat: 'cjs',
    tsNoCheckPreamble: false,
  }

  if (generatorType === 'prisma-client-ts') {
    await generateClientESM(clientGenOptions)
  } else {
    await generateClientLegacy(clientGenOptions)
  }

  const clientPathForRuntime: Record<ClientRuntime, { client: string; sql: string }> = {
    node: {
      client: 'generated/prisma/client',
      sql: path.join(outputPath, 'sql'),
    },
    edge: {
      client: generatorType === 'prisma-client-ts' ? 'generated/prisma/client' : 'generated/prisma/client/edge',
      sql: path.join(outputPath, 'sql', 'index.edge.js'),
    },
    'wasm-engine-edge': {
      client: generatorType === 'prisma-client-ts' ? 'generated/prisma/client' : 'generated/prisma/client/wasm',
      sql: path.join(outputPath, 'sql', 'index.wasm-engine-edge.js'),
    },
    'wasm-compiler-edge': {
      client: generatorType === 'prisma-client-ts' ? 'generated/prisma/client' : 'generated/prisma/client/wasm',
      sql: path.join(outputPath, 'sql', 'index.wasm-compiler-edge.js'),
    },
    client: {
      client: 'generated/prisma/client',
      sql: path.join(outputPath, 'sql'),
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

  if (clientMeta.runtime === 'wasm-engine-edge') {
    __internal.configOverride = (config) => {
      config.engineWasm = {
        getRuntime: () => Promise.resolve(require(path.join(runtimeBase, `query_engine_bg.${provider}.js`))),
        getQueryEngineWasmModule: async () => {
          const queryEngineWasmFilePath = path.join(runtimeBase, `query_engine_bg.${provider}.wasm`)
          const queryEngineWasmFileBytes = await readFile(queryEngineWasmFilePath)

          return new WebAssembly.Module(queryEngineWasmFileBytes)
        },
      }
      return config
    }
  } else if (clientMeta.runtime === 'client' || clientMeta.runtime === 'wasm-compiler-edge') {
    __internal.configOverride = (config) => {
      config.compilerWasm = {
        getRuntime: () => Promise.resolve(require(path.join(runtimeBase, `query_compiler_bg.${provider}.js`))),
        getQueryCompilerWasmModule: async () => {
          const queryCompilerWasmFilePath = path.join(runtimeBase, `query_compiler_bg.${provider}.wasm`)
          const queryCompilerWasmFileBytes = await readFile(queryCompilerWasmFilePath)

          return new WebAssembly.Module(queryCompilerWasmFileBytes)
        },
      }
      return config
    }
  }

  if (driverAdapter === AdapterProviders.JS_PG || driverAdapter === AdapterProviders.JS_PG_COCKROACHDB) {
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

  if (driverAdapter === AdapterProviders.JS_BETTER_SQLITE3) {
    const { PrismaBetterSQLite3 } =
      require('@prisma/adapter-better-sqlite3') as typeof import('@prisma/adapter-better-sqlite3')

    return {
      adapter: new PrismaBetterSQLite3({
        // Workaround to avoid the Prisma validation error:
        // ```
        // Error validating datasource `db`: the URL must start with the protocol `file:`
        // ```
        url: datasourceInfo.databaseUrl.replace('file:', ''),
      }),
      __internal,
    }
  }

  if (driverAdapter === AdapterProviders.JS_MSSQL) {
    const { PrismaMssql } = require('@prisma/adapter-mssql') as typeof import('@prisma/adapter-mssql')

    const [, server, port, database, user, password] =
      datasourceInfo.databaseUrl.match(
        /^sqlserver:\/\/([^:;]+):(\d+);database=([^;]+);user=([^;]+);password=([^;]+);/,
      ) || []

    return {
      adapter: new PrismaMssql({
        user,
        password,
        database,
        server,
        port: Number(port),
        options: {
          trustServerCertificate: true,
        },
      }),
      __internal,
    }
  }

  if (driverAdapter === 'js_mariadb') {
    const { PrismaMariaDb } = require('@prisma/adapter-mariadb') as typeof import('@prisma/adapter-mariadb')

    const url = new URL(datasourceInfo.databaseUrl)
    const { username: user, password, hostname: host, port } = url
    const database = url.pathname && url.pathname.slice(1)

    return {
      adapter: new PrismaMariaDb({
        user,
        password,
        database,
        host,
        port: Number(port),
        connectionLimit: 4, // avoid running out of connections, some tests create multiple clients
      }),
      __internal,
    }
  }

  throw new Error(`No Driver Adapter support for ${driverAdapter}`)
}
