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
import {
  setupTestSuiteDatabase,
  setupTestSuiteFiles,
  setupTestSuiteSchema,
  setupTestSuiteTypes,
} from './setupTestSuiteEnv'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

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
  await setupTestSuiteTypes(suiteMeta, suiteConfig, dmmf)
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
    engineVersion: 'local',
    clientVersion: 'local',
    transpile: false,
    testMode: true,
    activeProvider: suiteConfig['#PROVIDER'],
    runtimeDir: path.join(__dirname, '..', '..', '..', 'runtime'),
    projectRoot: suiteFolderPath,
  })

  return require(path.join(suiteFolderPath, 'node_modules/@prisma/client'))
}
