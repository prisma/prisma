import { getConfig, parseEnvValue } from '@prisma/sdk'

import { getDMMF } from '../../src/generation/getDMMF'
import { getPrismaClient } from '../../src/runtime'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuitePreviewFeatures, getTestSuitePrismaPath, getTestSuiteSchema } from './getTestSuiteInfo'
import type { TestSuiteMeta } from './setupClientTest'
import {
  setupTestSuiteDatabase,
  setupTestSuiteFiles,
  setupTestSuiteSchema,
  setupTestSuiteTypes,
} from './setupTestSuiteEnv'

export async function getInMemoryClient(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const testSuitePrismaPath = getTestSuitePrismaPath(suiteMeta, suiteConfig)
  const previewFeatures = getTestSuitePreviewFeatures(suiteConfig)
  const schema = await getTestSuiteSchema(suiteMeta, suiteConfig)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupTestSuiteFiles(suiteMeta, suiteConfig)
  await setupTestSuiteSchema(suiteMeta, suiteConfig, schema)
  await setupTestSuiteTypes(suiteMeta, suiteConfig, dmmf)
  await setupTestSuiteDatabase(suiteMeta, suiteConfig)

  return getPrismaClient({
    dirname: testSuitePrismaPath,
    schemaString: schema,
    document: dmmf,
    generator: generator,
    activeProvider: suiteConfig['#PROVIDER'],
    datasourceNames: config.datasources.map((d) => d.name),
    relativeEnvPaths: {},
    relativePath: '.',
  }) as any
}
