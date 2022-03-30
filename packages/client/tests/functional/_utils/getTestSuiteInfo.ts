import fs from 'fs-extra'
import path from 'path'

import { keys } from '../../../../../helpers/blaze/keys'
import { map } from '../../../../../helpers/blaze/map'
import { matrix } from '../../../../../helpers/blaze/matrix'
import { merge } from '../../../../../helpers/blaze/merge'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

export type TestSuiteMatrix = { [K in string]: string }[][]
export type TestSuiteConfig = ReturnType<typeof getTestSuiteConfigs>[number]

/**
 * Get the generated test suite name, used for the folder name.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
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

/**
 * Get the generated test suite features, used for client generation.
 * @param suiteConfig
 * @returns
 */
export function getTestSuitePreviewFeatures(suiteConfig: TestSuiteConfig) {
  // eslint-disable-next-line prettier/prettier
  return [...(suiteConfig['#FEATURES']?.split(', ') ?? []), ...(suiteConfig['#EXTRA_FEATURES']?.split(', ') ?? [])]
}

/**
 * Get the generated test suite path, where files will be copied to.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteFolderPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const generatedFolder = path.join(suiteMeta.prismaPath, '..', '.generated')
  const suiteName = getTestSuiteFullName(suiteMeta, suiteConfig)
  const suiteFolder = path.join(generatedFolder, suiteName)

  return suiteFolder
}

/**
 * Get the generated test suite schema file path.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteSchemaPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const prismaFolder = getTestSuitePrismaPath(suiteMeta, suiteConfig)
  const schemaPath = path.join(prismaFolder, 'schema.prisma')

  return schemaPath
}

/**
 * Get the generated test suite prisma folder path.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuitePrismaPath(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const prismaPath = path.join(suiteFolder, 'prisma')

  return prismaPath
}

/**
 * Transforms the `_matrix.ts` into the cross-product of config objects.
 * @param suiteMeta
 * @returns
 */
export function getTestSuiteConfigs(suiteMeta: TestSuiteMeta) {
  const rawMatrix = require(suiteMeta.matrixPath).default() as TestSuiteMatrix

  return map(matrix(rawMatrix), (configs) => merge(configs))
}

/**
 * Get a jest-compatible test suite table from the test suite configs.
 * @param suiteMeta
 * @returns [test-suite-title: string, test-suite-config: object]
 */
export function getTestSuiteTable(suiteMeta: TestSuiteMeta) {
  return map(
    getTestSuiteConfigs(suiteMeta),
    (suiteConfig) => [getTestSuiteFullName(suiteMeta, suiteConfig), suiteConfig] as const,
  )
}

/**
 * Inflate the base schema with a test suite config, used for schema generation.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export async function getTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  const schemaPath = path.join(suiteMeta.prismaPath, 'schema.prisma.txt')
  let schema = await fs.readFile(schemaPath, 'utf-8')

  for (const key of keys(suiteConfig)) {
    schema = schema.replaceAll(key, suiteConfig[key])
  }

  return schema
}

/**
 * Get metadata about the original test suite executed by jest.
 * @returns
 */
export function getTestSuiteMeta() {
  const testPath = expect.getState().testPath
  const testDir = path.dirname(testPath)
  const suiteName = path.basename(path.basename(testDir))
  const matrixPath = path.join(testDir, '_matrix')
  const prismaPath = path.join(testDir, 'prisma')

  return { testPath, testDir, suiteName, matrixPath, prismaPath }
}
