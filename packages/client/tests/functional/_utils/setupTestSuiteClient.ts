import { createClient as createLibSqlClient } from '@libsql/client'
import { neonConfig, Pool as neonPool } from '@neondatabase/serverless'
import { connect } from '@planetscale/database'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { getConfig, getDMMF, parseEnvValue } from '@prisma/internals'
import path from 'path'
import { Pool as pgPool } from 'pg'
import { fetch, WebSocket } from 'undici'

import { generateClient } from '../../../src/generation/generateClient'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
} from './getTestSuiteInfo'
import { ProviderFlavors } from './providers'
import { DatasourceInfo, setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { AlterStatementCallback, ClientMeta, ClientRuntime } from './types'

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns loaded client module
 */
export async function setupTestSuiteClient({
  suiteMeta,
  suiteConfig,
  datasourceInfo,
  clientMeta,
  skipDb,
  alterStatementCallback,
}: {
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  skipDb?: boolean
  alterStatementCallback?: AlterStatementCallback
}) {
  const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const schema = getTestSuiteSchema(suiteMeta, suiteConfig.matrixOptions)
  const previewFeatures = getTestSuitePreviewFeatures(schema)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupTestSuiteFiles(suiteMeta, suiteConfig)
  await setupTestSuiteSchema(suiteMeta, suiteConfig, schema)

  process.env[datasourceInfo.directEnvVarName] = datasourceInfo.databaseUrl
  process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl

  if (skipDb !== true) {
    await setupTestSuiteDatabase(suiteMeta, suiteConfig, [], alterStatementCallback)
  }

  if (clientMeta.dataProxy === true) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.dataProxyUrl
  } else {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
  }

  await generateClient({
    datamodel: schema,
    schemaPath: getTestSuiteSchemaPath(suiteMeta, suiteConfig),
    binaryPaths: { libqueryEngine: {}, queryEngine: {} },
    datasources: config.datasources,
    outputDir: path.join(suiteFolderPath, 'node_modules/@prisma/client'),
    copyRuntime: false,
    dmmf: dmmf,
    generator: generator,
    engineVersion: '0000000000000000000000000000000000000000',
    clientVersion: '0.0.0',
    transpile: false,
    testMode: true,
    activeProvider: suiteConfig.matrixOptions.provider,
    // Change \\ to / for windows support
    runtimeDirs: {
      node: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
      edge: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
    },
    projectRoot: suiteFolderPath,
    noEngine: clientMeta.dataProxy,
  })

  const clientPathForRuntime: Record<ClientRuntime, string> = {
    node: 'node_modules/@prisma/client',
    edge: 'node_modules/@prisma/client/edge',
  }

  return require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime]))
}

/**
 * Automatically loads the driver adapter for the test suite client.
 */
export function setupTestSuiteClientDriverAdapter({
  suiteConfig,
  datasourceInfo,
  clientMeta,
  _suiteMeta,
}: {
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  suiteMeta: TestSuiteMeta
}) {
  const providerFlavor = suiteConfig.matrixOptions.providerFlavor

  if (clientMeta.driverAdapter !== true) return {}

  if (providerFlavor === undefined) {
    throw new Error(`Missing provider flavor`)
  }

  if (providerFlavor === ProviderFlavors.JS_PG) {
    //const testName = getTestSuiteFullName(suiteMeta, suiteConfig)
    // console.log('###', testName)

    const pool = new pgPool({
      connectionString: datasourceInfo.databaseUrl,
    })

    return { adapter: new PrismaPg(pool) } //, testName) }
  }

  if (providerFlavor === ProviderFlavors.JS_NEON) {
    neonConfig.wsProxy = () => `127.0.0.1:5488/v1`
    neonConfig.webSocketConstructor = WebSocket
    neonConfig.useSecureWebSocket = false // disable tls
    neonConfig.pipelineConnect = false

    const pool = new neonPool({
      connectionString: datasourceInfo.databaseUrl,
    })

    return { adapter: new PrismaNeon(pool) }
  }

  if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
    const connection = connect({
      url: 'http://root:root@127.0.0.1:8085',
      fetch, // TODO remove when Node 16 is deprecated
    })

    return { adapter: new PrismaPlanetScale(connection) }
  }

  if (providerFlavor === ProviderFlavors.JS_LIBSQL) {
    const client = createLibSqlClient({
      url: datasourceInfo.databaseUrl,
      intMode: 'bigint',
    })

    return { adapter: new PrismaLibSQL(client) }
  }

  throw new Error(`Unsupported provider flavor ${providerFlavor}`)
}
