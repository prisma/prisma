import fs from 'fs-extra'
import path from 'path'

import { keys } from '../../../../../helpers/blaze/keys'
import { map } from '../../../../../helpers/blaze/map'
import { matrix } from '../../../../../helpers/blaze/matrix'
import { merge } from '../../../../../helpers/blaze/merge'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

export type TestSuiteMatrix = { [K in string]: string }[][]
export type TestSuiteConfig = ReturnType<typeof getTestSuiteConfigs>[number]

export function getTestSuiteFullName(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  let name = `${suiteMeta.suiteName} - ${suiteConfig['#PROVIDER']}`

  name += ` - [`
  if (suiteConfig['#FEATURES']) {
    name += `${suiteConfig['#FEATURES']}`
  }

  if (suiteConfig['#EXTRA_FEATURES']) {
    name += `${suiteConfig['#EXTRA_FEATURES']}`
  }
  name += `]`

  return name
}

export function getTestSuitePreviewFeatures(suiteConfig: TestSuiteConfig) {
  // eslint-disable-next-line prettier/prettier
  return [...(suiteConfig['#FEATURES']?.split(', ') ?? []), ...(suiteConfig['#EXTRA_FEATURES']?.split(', ') ?? [])]
}

export function getTestSuiteFolderPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const generatedFolder = path.join(suiteMeta.prismaPath, '..', '.generated')
  const suiteName = getTestSuiteFullName(suiteMeta, suiteConfig)
  const suiteFolder = path.join(generatedFolder, suiteName)

  return suiteFolder
}

export function getTestSuiteSchemaPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const prismaFolder = getTestSuitePrismaPath(suiteMeta, suiteConfig)
  const schemaPath = path.join(prismaFolder, 'schema.prisma')

  return schemaPath
}

export function getTestSuitePrismaPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const prismaPath = path.join(suiteFolder, 'prisma')

  return prismaPath
}

export function getTestSuiteConfigs(suiteMeta: TestSuiteMeta) {
  const rawMatrix = require(suiteMeta.matrixPath).default() as TestSuiteMatrix

  return map(matrix(rawMatrix), (configs) => merge(configs))
}

export function getTestSuiteTable(suiteMeta: TestSuiteMeta) {
  return map(
    getTestSuiteConfigs(suiteMeta),
    (suiteConfig) => [getTestSuiteFullName(suiteMeta, suiteConfig), suiteConfig] as const,
  )
}

export async function getTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = path.join(suiteMeta.prismaPath, 'schema.prisma.txt')
  let schema = await fs.readFile(schemaPath, 'utf-8')

  for (const key of keys(suiteConfig)) {
    schema = schema.replaceAll(key, suiteConfig[key])
  }

  return schema
}

export function getTestSuiteMeta() {
  const testPath = expect.getState().testPath
  const testDir = path.dirname(testPath)
  const suiteName = path.basename(path.basename(testDir))
  const matrixPath = path.join(testDir, '_matrix')
  const prismaPath = path.join(testDir, 'prisma')

  return { testPath, testDir, suiteName, matrixPath, prismaPath }
}
