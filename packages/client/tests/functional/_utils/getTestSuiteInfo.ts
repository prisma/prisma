import path from 'path'

import { map } from '../../../../../helpers/blaze/map'
import { matrix } from '../../../../../helpers/blaze/matrix'
import { merge } from '../../../../../helpers/blaze/merge'
import { MatrixTestHelper } from './defineMatrix'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

export type TestSuiteMatrix = { [K in string]: string }[][]
export type TestSuiteConfig = ReturnType<typeof getTestSuiteConfigs>[number]

type MatrixModule = (() => TestSuiteMatrix) | MatrixTestHelper<TestSuiteMatrix>

/**
 * Get the generated test suite name, used for the folder name.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteFullName(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  let name = ``

  name += `${suiteMeta.testDirName.replace(/\\|\//, '.')}`

  name += ` (${suiteConfig['provider']})`

  name += ` (`
  if (suiteConfig['providerFeatures']) {
    name += `${suiteConfig['providerFeatures']}`
  }

  if (suiteConfig['previewFeatures']) {
    name += `${suiteConfig['previewFeatures']}`
  }
  name += `)`

  // replace illegal chars with empty string
  return name.replace(/[<>:"\/\\|?*]/g, '')
}

/**
 * Get the generated test suite features, used for client generation.
 * @param suiteConfig
 * @returns
 */
export function getTestSuitePreviewFeatures(suiteConfig: TestSuiteConfig) {
  return [
    ...(suiteConfig['providerFeatures']?.split(', ') ?? []),
    ...(suiteConfig['previewFeatures']?.split(', ') ?? []),
  ]
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
  const matrixModule = require(suiteMeta._matrixPath).default as MatrixModule

  const rawMatrix = typeof matrixModule === 'function' ? matrixModule() : matrixModule.matrix()

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
export function getTestSuiteSchema(suiteMeta: TestSuiteMeta, suiteConfig: TestSuiteConfig) {
  return require(suiteMeta._schemaPath).default(suiteConfig)
}

/**
 * Get metadata about the original test suite executed by jest.
 * @returns
 */
export function getTestSuiteMeta() {
  const testsDir = path.join(path.dirname(__dirname), '/')
  const testPath = expect.getState().testPath
  const testDir = path.dirname(testPath)
  const testDirName = testDir.replace(testsDir, '')
  const testFileName = path.basename(testPath)
  const prismaPath = path.join(testDir, 'prisma')
  const _matrixPath = path.join(testDir, '_matrix')
  const _schemaPath = path.join(prismaPath, '_schema')

  return { testPath, testDir, testDirName, testFileName, prismaPath, _matrixPath, _schemaPath }
}
