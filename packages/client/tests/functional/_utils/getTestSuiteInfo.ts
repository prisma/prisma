import path from 'path'

import { matrix } from '../../../../../helpers/blaze/matrix'
import { merge } from '../../../../../helpers/blaze/merge'
import { MatrixTestHelper } from './defineMatrix'
import { isDriverAdapterProviderFlavor, ProviderFlavors, Providers, RelationModes } from './providers'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, TestCliMeta } from './types'

export type TestSuiteMatrix = { [K in string]: any }[][]
export type NamedTestSuiteConfig = {
  parametersString: string
  matrixOptions: Record<string, string> & {
    provider: Providers
    providerFlavor?: ProviderFlavors
    relationMode?: RelationModes
  }
}

type MatrixModule = (() => TestSuiteMatrix) | MatrixTestHelper<TestSuiteMatrix>

const allProvidersRegexUnion = Object.values(Providers).join('|')
const schemaPreviewFeaturesRegex = /previewFeatures\s*=\s*(.*)/
const schemaDefaultGeneratorRegex = /provider\s*=\s*"prisma-client-js"/
const schemaProviderRegex = new RegExp(`provider\\s*=\\s*"(?:${allProvidersRegexUnion})"`, 'g')
const schemaPrismaRelationModeRegex = /relationMode\s*=\s*".*"/

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
export function getTestSuitePreviewFeatures(schema: string): string[] {
  const match = schema.match(schemaPreviewFeaturesRegex)

  return match === null ? [] : JSON.parse(match[1])
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
export function getTestSuiteConfigs(suiteMeta: TestSuiteMeta) {
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

  const configs = matrix(rawMatrix)
    .map((configs) => ({
      parametersString: getTestSuiteParametersString(configs),
      matrixOptions: merge(configs),
    }))
    .filter(({ matrixOptions }) => !exclude(matrixOptions))

  return configs as NamedTestSuiteConfig[]
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
      // Note: if the name is too long tests will fail with
      // `ENAMETOOLONG: name too long` as this is used for the directory name

      // For `relationMode` tests
      // we hardcode how it looks like for test results
      if (config.relationMode !== undefined) {
        const providerFlavorStr = config.providerFlavor === undefined ? '' : `providerFlavor=${config.providerFlavor},`
        return `relationMode=${config.relationMode},provider=${config.provider},${providerFlavorStr}onUpdate=${config.onUpdate},onDelete=${config.onDelete},id=${config.id}`
      } else {
        const firstKey = Object.keys(config)[0] // ! TODO this can actually produce incorrect tests and break type checks ! \\ Replace with hash
        return `${firstKey}=${config[firstKey]}`
      }
    })
    .join(', ')
}

/**
 * Inflate the base schema with a test suite config, used for schema generation.
 * @param suiteMeta
 * @param suiteConfig
 * @returns
 */
export function getTestSuiteSchema(suiteMeta: TestSuiteMeta, matrixOptions: NamedTestSuiteConfig['matrixOptions']) {
  let schema = require(suiteMeta._schemaPath).default(matrixOptions) as string
  const previewFeatureMatch = schema.match(schemaPreviewFeaturesRegex)
  const defaultGeneratorMatch = schema.match(schemaDefaultGeneratorRegex)
  const prismaRelationModeMatch = schema.match(schemaPrismaRelationModeRegex)
  const providerMatch = schema.match(schemaProviderRegex)
  const previewFeatures = getTestSuitePreviewFeatures(schema)

  // By default, mini-proxy distinguishes different engine instances using
  // inline schema hash. In case 2 tests are running in parallel with identical
  // schema, this can cause all kinds of problems. Adding a unique comment at
  // the top of schema file forces them to have different hash and fixes this.
  schema = `// ${JSON.stringify({ test: suiteMeta.testPath, matrixOptions })}\n${schema}`

  // in some cases we may add more preview features automatically to the schema
  // when we are running tests for driver adapters, auto add the preview feature
  if (isDriverAdapterProviderFlavor(matrixOptions.providerFlavor)) previewFeatures.push('driverAdapters')

  const previewFeaturesStr = `previewFeatures = ${JSON.stringify(previewFeatures)}`

  // if there's already a preview features block, replace it with the updated one
  if (previewFeatureMatch !== null) {
    schema = schema.replace(previewFeatureMatch[0], previewFeaturesStr)
  }

  // if there's no preview features, append them to the default generator block
  if (previewFeatureMatch === null && defaultGeneratorMatch !== null) {
    schema = schema.replace(defaultGeneratorMatch[0], `${defaultGeneratorMatch[0]}\n${previewFeaturesStr}`)
  }

  // for PlanetScale and Vitess, we need to add `relationMode = "prisma"` to the schema
  if (matrixOptions.relationMode && providerMatch !== null) {
    const relationModeStr = `relationMode = "${matrixOptions.relationMode}"`

    if (prismaRelationModeMatch === null) {
      schema = schema.replace(providerMatch[0], `${providerMatch![0]}\n${relationModeStr}`)
    }
  }

  return schema
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

/**
 * Get `TestCliMeta` from the environment variables created by the test CLI.
 */
export function getTestSuiteCliMeta(): TestCliMeta {
  const edge = Boolean(process.env.TEST_DATA_PROXY_EDGE_CLIENT)
  const dataProxy = Boolean(process.env.TEST_DATA_PROXY)

  if (edge && !dataProxy) {
    throw new Error('Edge client requires Data Proxy')
  }

  return {
    dataProxy,
    runtime: edge ? 'edge' : 'node',
  }
}

/**
 * Get `ClientMeta` information to be passed down into the test suite.
 */
export function getTestSuiteClientMeta(suiteConfig: NamedTestSuiteConfig['matrixOptions']): ClientMeta {
  return {
    ...getTestSuiteCliMeta(),
    driverAdapter: isDriverAdapterProviderFlavor(suiteConfig.providerFlavor),
  }
}
