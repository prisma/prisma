import { getClientEngineType, getConfig, getPlatform, parseEnvValue } from '@prisma/sdk'
import path from 'path'

import { generateClient } from '../../../src/generation/generateClient'
import { getDMMF } from '../../../src/generation/getDMMF'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import {
  getTestSuiteFolderPath,
  getTestSuitePreviewFeatures,
  getTestSuiteSchema,
  getTestSuiteSchemaPath,
} from './getTestSuiteInfo'
import { setupQueryEngine } from './setupQueryEngine'
import { setupTestSuiteDatabase, setupTestSuiteFiles, setupTestSuiteSchema } from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

/**
 * Does the necessary setup to get a test suite client ready to run.
 * @param suiteMeta
 * @param suiteConfig
 * @returns loaded client module
 */
export async function setupTestSuiteClient(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const previewFeatures = getTestSuitePreviewFeatures(suiteConfig)
  const schema = await getTestSuiteSchema(suiteMeta, suiteConfig)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupQueryEngine(getClientEngineType(generator!), await getPlatform())
  await setupTestSuiteFiles(suiteMeta, suiteConfig)
  await setupTestSuiteSchema(suiteMeta, suiteConfig, schema)
  await setupTestSuiteDatabase(suiteMeta, suiteConfig)

  await generateClient({
    datamodel: schema,
    datamodelPath: getTestSuiteSchemaPath(suiteMeta, suiteConfig),
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
    activeProvider: suiteConfig['provider'],
    // Change \\ to / for windows support
    runtimeDir: [__dirname.replace(/\\/g, '/'), '..', '..', '..', 'runtime'].join('/'),
    projectRoot: suiteFolderPath,
  })

  return require(path.join(suiteFolderPath, 'node_modules/@prisma/client'))
}
