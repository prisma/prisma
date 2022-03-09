import { getConfig, parseEnvValue } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'

import { map } from '../../../../helpers/blaze/map'
import { matrix } from '../../../../helpers/blaze/matrix'
import { merge } from '../../../../helpers/blaze/merge'
import { record } from '../../../../helpers/blaze/record'
import { getDMMF } from '../../src/generation/getDMMF'
import { getPrismaClient } from '../../src/runtime'

process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'
process.env.DATABASE_URL_sqlite = 'file:dev.db'
process.env.DATABASE_URL_mongodb = process.env.TEST_MONGO_URI

const testPath = expect.getState().testPath
const testDir = path.dirname(testPath)
const suiteName = path.basename(path.basename(testDir))
const matrixPath = path.join(testDir, '_matrix')
const prismaPath = path.join(testDir, 'prisma')
const schemaPath = path.join(prismaPath, 'schema.prisma')

type TestSuiteMatrix = {
  provider: { [K in string]: string }[]
  previewFeatures: { [K in string]: string }[]
}

type TestSuiteConfig = ReturnType<typeof getTestSuiteConfigs>[number]

function getTestSuiteConfigs() {
  const rawMatrix = require(matrixPath).default() as TestSuiteMatrix
  const mapMatrix = map(rawMatrix, (list, key) => map(list, (item) => record([key], [item])))
  const configsMatrix = matrix(Object.values(mapMatrix))

  return map(configsMatrix, (configs) => merge(configs))
}

async function replaceTestConfigInSchema(suiteConfig: TestSuiteConfig) {
  const schemaBase = await fs.promises.readFile(schemaPath, 'utf-8')

  const filledSchema = schemaBase
    .replaceAll('PROVIDER', suiteConfig.provider['PROVIDER'])
    .replaceAll('ID', suiteConfig.provider['ID'])
    .replaceAll('FEATURE', suiteConfig.previewFeatures['FEATURE'])

  return filledSchema
}

async function getInMemoryClient<C>(suiteConfig: TestSuiteConfig) {
  const schema = await replaceTestConfigInSchema(suiteConfig)
  const dmmf = await getDMMF({ datamodel: schema, previewFeatures: [] }) // TODO
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  const generator = config.generators.find((g) => parseEnvValue(g.provider) === 'prisma-client-js')

  return getPrismaClient({
    dirname: prismaPath,
    schemaString: schema,
    document: dmmf,
    generator: generator,
    activeProvider: suiteConfig.provider.PROVIDER,
    datasourceNames: config.datasources.map((d) => d.name),
    relativeEnvPaths: {}, // TODO
    relativePath: '',
  }) as any as C
}

function getTestSuiteName(suiteConfig: TestSuiteConfig) {
  let name = `${suiteName} - ${suiteConfig.provider.PROVIDER}`

  if (suiteConfig.previewFeatures.FEATURE) {
    name += ` - ${suiteConfig.previewFeatures.FEATURE}`
  }

  return name
}

function getTestSuiteTable() {
  const suiteConfigs = getTestSuiteConfigs()

  // eslint-disable-next-line prettier/prettier
  return map(suiteConfigs, (suiteConfig) => [getTestSuiteName(suiteConfig), suiteConfig] as const)
}

function setup<C>(tests: (PrismaClient: Promise<C>) => void) {
  const suiteTable = getTestSuiteTable()
  describe.each(suiteTable)('%s', (_, suiteConfig) => {
    tests(getInMemoryClient<C>(suiteConfig))
  })
}

export { setup }
