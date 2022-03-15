import { getConfig, parseEnvValue } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'

import { keys } from '../../../../helpers/blaze/keys'
import { getDMMF } from '../../src/generation/getDMMF'
import { getPrismaClient } from '../../src/runtime'
import type { TestSuiteConfig } from './getTestSuiteInfo'
import { getPreviewFeaturesFromTestConfig, getTestSuitePrismaPath } from './getTestSuiteInfo'
import { setupClientDatabase, setupClientFolder, setupClientSchema } from './setupClientEnv'
import type { TestSuiteMeta } from './setupClientTest'

export async function getInMemoryClient(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const testSuitePath = getTestSuitePrismaPath(suiteMeta, suiteConfig)
  const previewFeatures = getPreviewFeaturesFromTestConfig(suiteConfig)
  const schema = await applyTestConfigToSchema(suiteMeta, suiteConfig)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures })
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  await setupClientFolder(suiteMeta, suiteConfig)
  await setupClientSchema(suiteMeta, suiteConfig, schema)
  await setupClientDatabase(suiteMeta, suiteConfig)

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

async function applyTestConfigToSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = path.join(suiteMeta.prismaPath, 'schema.prisma')
  let schema = await fs.promises.readFile(schemaPath, 'utf-8')

  for (const key of keys(suiteConfig)) {
    schema = schema.replaceAll(key, suiteConfig[key])
  }

  return schema
}
