import { getConfig, parseEnvValue } from '@prisma/internals'
import fs from 'fs'
import { copyFile } from 'fs-extra'
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
  skipDb,
  datasourceInfo,
  clientMeta,
  alterStatementCallback,
  useDefaultClient,
}: {
  suiteMeta: TestSuiteMeta
  suiteConfig: NamedTestSuiteConfig
  skipDb?: boolean
  datasourceInfo: DatasourceInfo
  clientMeta: ClientMeta
  alterStatementCallback?: AlterStatementCallback
  useDefaultClient?: boolean
}) {
  const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const previewFeatures = getTestSuitePreviewFeatures(suiteConfig.matrixOptions)
  const schema = getTestSuiteSchema(suiteMeta, suiteConfig.matrixOptions)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupTestSuiteFiles(suiteMeta, suiteConfig)
  await setupTestSuiteSchema(suiteMeta, suiteConfig, schema)
  if (!skipDb) {
    process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
    await setupTestSuiteDatabase(suiteMeta, suiteConfig, [], alterStatementCallback)
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

  if (useDefaultClient) {
    const prismaClientDir = path.join(suiteFolderPath, 'node_modules/', '@prisma', 'client')
    const prismaClientRuntimeDir = path.join(suiteFolderPath, 'node_modules/', '@prisma', 'client', 'runtime')
    const dotPrismaClientDir = path.join(suiteFolderPath, 'node_modules/', '.prisma/client')
    const scriptsPath = path.join(__dirname, '../../../scripts')
    const runtimePath = path.join(__dirname, '../../../runtime')
    const prismaClientRootPath = path.join(__dirname, '../../../')

    await fs.promises.mkdir(prismaClientRuntimeDir, { recursive: true })

    await fs.promises.mkdir(dotPrismaClientDir, { recursive: true })
    await fs.promises.writeFile(
      `${dotPrismaClientDir}/package.json`,
      JSON.stringify({ name: '.prisma/client', main: 'index.js', types: 'index.d.ts' }),
    )

    await copyFile(path.join(prismaClientRootPath, 'index.js'), path.join(prismaClientDir, 'index.js'))
    await copyFile(path.join(prismaClientRootPath, 'index.d.ts'), path.join(prismaClientDir, 'index.d.ts'))

    const defaultNodeIndexPath = path.join(dotPrismaClientDir, 'index.js')
    await copyFile(path.join(scriptsPath, 'default-index.js'), defaultNodeIndexPath)

    const defaultNodeIndexDtsPath = path.join(dotPrismaClientDir, 'index.d.ts')
    await copyFile(path.join(scriptsPath, 'default-index.d.ts'), defaultNodeIndexDtsPath)

    const defaultRuntimeNodeIndexPath = path.join(prismaClientRuntimeDir, 'index.js')
    await copyFile(path.join(runtimePath, 'index.js'), defaultRuntimeNodeIndexPath)

    const defaultRuntimeNodeIndexDtsPath = path.join(prismaClientRuntimeDir, 'index.d.ts')
    await copyFile(path.join(runtimePath, 'index.d.ts'), defaultRuntimeNodeIndexDtsPath)
  }

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
