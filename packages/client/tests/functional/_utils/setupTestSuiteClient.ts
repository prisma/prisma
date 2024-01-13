import { getConfig, getDMMF, parseEnvValue } from '@prisma/internals'
import path from 'path'
import { fetch, WebSocket } from 'undici'

import { generateClient } from '../../../src/generation/generateClient'
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
}: {
  cliMeta: CliMeta
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  skipDb?: boolean
  alterStatementCallback?: AlterStatementCallback
}) {
  const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const schema = getTestSuiteSchema(cliMeta, suiteMeta, suiteConfig.matrixOptions)
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

  // we return a callback, this allows us to clear jest modules cache if needed before hand
  return () => require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime]))
}

/**
 * Automatically loads the driver adapter for the test suite client.
 */
export function setupTestSuiteClientDriverAdapter({
  suiteConfig,
  datasourceInfo,
  clientMeta,
}: {
  suiteConfig: NamedTestSuiteConfig
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
}) {
  const driverAdapter = suiteConfig.matrixOptions.driverAdapter

  if (clientMeta.driverAdapter !== true) return {}

  if (driverAdapter === undefined) {
    throw new Error(`Missing Driver Adapter`)
  }

  if (driverAdapter === AdapterProviders.JS_PG) {
    const { Pool } = require('pg') as typeof import('pg')
    const { PrismaPg } = require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg')

    const pool = new Pool({
      connectionString: datasourceInfo.databaseUrl,
    })

    return { adapter: new PrismaPg(pool) }
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

    return { adapter: new PrismaNeon(pool) }
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

    return { adapter: new PrismaPlanetScale(client) }
  }

  if (driverAdapter === AdapterProviders.JS_LIBSQL) {
    const { createClient } = require('@libsql/client') as typeof import('@libsql/client')
    const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

    const client = createClient({
      url: datasourceInfo.databaseUrl,
      intMode: 'bigint',
    })

    return { adapter: new PrismaLibSQL(client) }
  }

  throw new Error(`No Driver Adapter support for ${driverAdapter}`)
}
