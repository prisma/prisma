import { getConfig, parseEnvValue } from '@prisma/internals'
import path from 'path'

import { generateClient } from '../../../src/generation/generateClient'
import { getDMMF } from '../../../src/generation/getDMMF'
import type { NamedTestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
} from './getTestSuiteInfo'
import { DatasourceInfo, setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, ClientRuntime } from './types'

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns loaded client module
 */
export async function setupTestSuiteClient({
  suiteMeta,
  suiteConfig,
  skipDb,
  datasourceInfo,
  clientMeta,
}: {
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  skipDb?: boolean
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
}) {
  const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const previewFeatures = getTestSuitePreviewFeatures(suiteConfig.matrixOptions)
  const schema = await getTestSuiteSchema(suiteMeta, suiteConfig.matrixOptions)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupTestSuiteFiles(suiteMeta, suiteConfig)
  await setupTestSuiteSchema(suiteMeta, suiteConfig, schema)
  if (!skipDb) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
    await setupTestSuiteDatabase(suiteMeta, suiteConfig)
  }

  process.env[datasourceInfo.envVarName] = datasourceInfo.dataProxyUrl ?? datasourceInfo.databaseUrl

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
    activeProvider: suiteConfig.matrixOptions['provider'] as string,
    // Change \\ to / for windows support
    runtimeDirs: {
      node: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
      edge: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
    },
    projectRoot: suiteFolderPath,
    dataProxy: clientMeta.dataProxy,
  })

  const clientPathForRuntime: Record<ClientRuntime, string> = {
    node: 'node_modules/@prisma/client',
    edge: 'node_modules/@prisma/client/edge',
  }

  return require(path.join(suiteFolderPath, clientPathForRuntime[clientMeta.runtime]))
}

/**
 * Get `ClientMeta` from the environment variables
 */
export function getClientMeta(): ClientMeta {
  const dataProxy = Boolean(process.env.DATA_PROXY)
  const edge = Boolean(process.env.TEST_DATA_PROXY_EDGE_CLIENT)

  if (edge && !dataProxy) {
    throw new Error('Edge client requires Data Proxy')
  }

  return {
    dataProxy,
    runtime: edge ? 'edge' : 'node',
  }
}
