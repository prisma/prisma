import path from 'path'

import { matrix } from '../../../../../helpers/blaze/matrix'
import { merge } from '../../../../../helpers/blaze/merge'
import { MatrixTestHelper } from './defineMatrix'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'

export type TestSuiteMatrix = { [K in string]: any }[][]
export type NamedTestSuiteConfig = {
  parametersString: string
  matrixOptions: Record<string, string>
}

type MatrixModule = (() => TestSuiteMatrix) | MatrixTestHelper<TestSuiteMatrix>

/**
 * Get the generated test suite name, used for the folder name.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteFullName(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig) {
  let name = ``

  name += `${suiteMeta.testName.replace(/\\|\//g, '.')}`

  name += ` (${suiteConfig.parametersString})`

  // replace illegal chars with empty string
  return name.replace(/[<>:"\/\\|?*]/g, '')
}

/**
 * Get the generated test suite features, used for client generation.
 * @param suiteConfig
 * @returns
 */
export function getTestSuitePreviewFeatures(matrixOptions: Record<string, string>) {
  return [
    ...(matrixOptions['providerFeatures']?.split(', ') ?? []),
    ...(matrixOptions['previewFeatures']?.split(', ') ?? []),
  ]
}

/**
 * Get the generated test suite path, where files will be copied to.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteFolderPath(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig) {
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
export function getTestSuiteSchemaPath(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig) {
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
export function getTestSuitePrismaPath(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig) {
  const suiteFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)
  const prismaPath = path.join(suiteFolder, 'prisma')

  return prismaPath
}

/**
 * Transforms the `_matrix.ts` into the cross-product of config objects.
 * @param suiteMeta
 * @returns
 */
export function getTestSuiteConfigs(suiteMeta: TestSuiteMeta): NamedTestSuiteConfig[] {
  const matrixModule = require(suiteMeta._matrixPath).default as MatrixModule

  let rawMatrix: TestSuiteMatrix
  let exclude: (config: Record<string, string>) => boolean

  if (typeof matrixModule === 'function') {
    rawMatrix = matrixModule()
    exclude = () => false
  } else {
    rawMatrix = matrixModule.matrix()
    exclude = matrixModule.matrixOptions?.exclude ?? (() => false)
  }

  return matrix(rawMatrix)
    .map((configs) => ({
      parametersString: getTestSuiteParametersString(configs),
      matrixOptions: merge(configs),
    }))
    .filter(({ matrixOptions }) => !exclude(matrixOptions))
}

/**
 * Returns "parameters string" part of the suite name
 * - From each matrix dimension takes first key-value pair. Assumption is that first pair
 * is what really distinguishes this particular suite and the rest are just additional options, related to that
 * parameter and do need to be part of the suite name.
 * - Computes "key1=value1,key2=value2" string from each dimension of the matrix
 * @param configs
 * @returns
 */
function getTestSuiteParametersString(configs: Record<string, string>[]) {
  return configs
    .map((config) => {
      return Object.entries(config).map(
        ([key, value]) => `${key}=${value !== null && typeof value === 'object' ? JSON.stringify(value) : value}`,
      )
    })
    .join(', ')
}

/**
 * Inflate the base schema with a test suite config, used for schema generation.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteSchema(suiteMeta: TestSuiteMeta, matrixOptions: Record<string, string>) {
  return require(suiteMeta._schemaPath).default(matrixOptions)
}

/**
 * Get metadata about the original test suite executed by jest.
 * @returns
 */
export function getTestSuiteMeta() {
  const testsDir = path.join(path.dirname(__dirname), '/')
  const testPath = expect.getState().testPath
  if (testPath === undefined) {
    throw new Error(`getTestSuiteMeta can be executed only within jest test`)
  }
  const testRootDirName = path.parse(testPath.replace(testsDir, '')).dir
  const testRoot = path.join(testsDir, testRootDirName)
  const rootRelativeTestPath = path.relative(testRoot, testPath)
  const rootRelativeTestDir = path.dirname(rootRelativeTestPath)
  let testName: string
  if (rootRelativeTestPath === 'tests.ts') {
    testName = testRootDirName
  } else {
    testName = path.join(testRootDirName, rootRelativeTestDir, path.basename(testPath, '.ts'))
  }
  const testFileName = path.basename(testPath)
  const prismaPath = path.join(testRoot, 'prisma')
  const _matrixPath = path.join(testRoot, '_matrix')
  const _schemaPath = path.join(prismaPath, '_schema')

  return {
    testName,
    testPath,
    testRoot,
    rootRelativeTestPath,
    rootRelativeTestDir,
    testFileName,
    prismaPath,
    _matrixPath,
    _schemaPath,
  }
}
