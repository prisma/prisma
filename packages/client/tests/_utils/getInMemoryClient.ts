import { getConfig, parseEnvValue } from '@prisma/sdk'

import { getDMMF } from '../../src/generation/getDMMF'
import { getPrismaClient } from '../../src/runtime'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getTestSuitePreviewFeatures, getTestSuitePrismaPath, getTestSuiteSchema } from './getTestSuiteInfo'
import { setupClientDatabase, setupClientFolder, setupClientSchema } from './setupClientEnv'
import type { TestSuiteMeta } from './setupClientTest'

export async function getInMemoryClient(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  // !\ these must be kept sync calls for auto type tests to work
  const testSuitePath = getTestSuitePrismaPath(suiteMeta, suiteConfig)
  const previewFeatures = getTestSuitePreviewFeatures(suiteConfig)
  const schema = getTestSuiteSchema(suiteMeta, suiteConfig)

  setupClientFolder(suiteMeta, suiteConfig)
  setupClientSchema(suiteMeta, suiteConfig, schema)
  await setupClientDatabase(suiteMeta, suiteConfig)

  // !\ async calls happen after for auto type testing to work
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  return getPrismaClient({
    dirname: testSuitePath,
    schemaString: schema,
    document: dmmf,
    generator: generator,
    activeProvider: suiteConfig['#PROVIDER'],
    datasourceNames: config.datasources.map((d) => d.name),
    relativeEnvPaths: {},
    relativePath: '.',
  }) as any
}
