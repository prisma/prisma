import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import { klona } from 'klona'

import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { flavorsForProvider, ProviderFlavors, Providers, relationModesForFlavor } from './providers'
import { TestSuiteMeta } from './setupTestSuiteMatrix'
import { MatrixOptions, TestCliMeta } from './types'

export type TestPlanEntry = {
  name: string
  skip: boolean
  suiteConfig: NamedTestSuiteConfig
}

type SuitePlanContext = {
  includedProviders?: string[]
  includedProviderFlavors?: string[]
  excludedProviders: string[]
  excludedProviderFlavors: string[]
  updateSnapshots: 'inline' | 'external' | undefined
}

/**
 * Get a test plan from a list of suite configs. Test plan tells what the name of
 * the tests are, what are their config and whether or not they should be executed or skipped
 * @param suiteMeta
 * @returns [test-suite-title: string, test-suite-config: object]
 */
export function getTestSuitePlan(
  suiteMeta: TestSuiteMeta,
  suiteConfigs: NamedTestSuiteConfig[],
  testCliMeta: TestCliMeta,
  options?: MatrixOptions,
): TestPlanEntry[] {
  const context = buildPlanContext()

  const shouldSkipAll = shouldSkipTestSuite(testCliMeta, options)

  const expandedSuiteConfigs = suiteConfigs.flatMap((config) => {
    return getExpandedTestSuitePlanWithProviderFlavors(config)
  })

  return expandedSuiteConfigs.map((namedConfig, configIndex) => ({
    name: getTestSuiteFullName(suiteMeta, namedConfig),
    skip: shouldSkipAll || shouldSkipSuiteConfig(context, namedConfig, configIndex, testCliMeta, options),
    suiteConfig: namedConfig,
  }))
}

/**
 * This function takes a regular `testPlanEntry` and expands this into the
 * multiple flavors of driver adapters that exist for a given provider. For
 * example, postgres => [postgres (pg), postgres (neon)], put very simply. In
 * other words, a given test matrix is expanded with the provider flavors.
 * @param suiteConfig
 * @returns
 */
function getExpandedTestSuitePlanWithProviderFlavors(suiteConfig: NamedTestSuiteConfig) {
  const provider = suiteConfig.matrixOptions.provider

  const suiteConfigExpansions = flavorsForProvider[provider].map((flavor) => {
    const newSuiteConfig = klona(suiteConfig)

    newSuiteConfig.matrixOptions.providerFlavor = flavor
    newSuiteConfig.parametersString += `, ${flavor}`
    // ^^^ temporary until I get to the TODO in getTestSuiteParametersString

    // if the test is not doing stuff with relation mode already, we set one
    if (newSuiteConfig.matrixOptions.relationMode === undefined) {
      newSuiteConfig.matrixOptions.relationMode = relationModesForFlavor[flavor]
    }

    return newSuiteConfig
  })

  // add the original suite config to the list of expanded configs
  return [suiteConfig, ...suiteConfigExpansions]
}

function shouldSkipTestSuite(clientMeta: TestCliMeta, options?: MatrixOptions): boolean {
  if (options?.skipBinary && getClientEngineType() === ClientEngineType.Binary) {
    return true
  }
  if (options?.skipDataProxy && clientMeta.dataProxy) {
    return options.skipDataProxy.runtimes.includes(clientMeta.runtime)
  }
  return false
}

function shouldSkipSuiteConfig(
  {
    updateSnapshots,
    includedProviders,
    includedProviderFlavors,
    excludedProviders,
    excludedProviderFlavors,
  }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  testCliMeta: TestCliMeta,
  options?: MatrixOptions,
): boolean {
  const provider = config.matrixOptions.provider
  const flavor = config.matrixOptions.providerFlavor
  const relationMode = config.matrixOptions.relationMode

  if (updateSnapshots === 'inline' && configIndex > 0) {
    // when updating inline snapshots, we have to run a  single suite only -
    // otherwise jest will fail with "Multiple inline snapshots for the same call are not supported" error
    return true
  }

  if (updateSnapshots === 'external' && configIndex === 0) {
    // when updating external snapshots, we assume that inline snapshots update was run just before it - so
    // there is no reason to re-run the first suite
    return true
  }

  // if the client doesn't support the provider, skip
  if (testCliMeta.dataProxy && provider === Providers.SQLITE) {
    return true
  }

  // if the provider is not included, skip
  if (includedProviders !== undefined && !includedProviders.includes(provider)) {
    return true
  }

  // if the provider is excluded, skip
  if (excludedProviders.includes(provider)) {
    return true
  }

  // if there is a flavor to run and it's not included, skip
  if (flavor !== undefined && !includedProviderFlavors?.includes(flavor)) {
    return true
  }

  // if there is a flavor to run and it's excluded, skip
  if (flavor && excludedProviderFlavors.includes(flavor)) {
    return true
  }

  // if the flavor is explicitly skipped in the matrix options, skip
  if (flavor !== undefined && options?.skipProviderFlavor?.from.includes(flavor)) {
    return true
  }

  // if there is a relation mode set and the flavor doesn't support it, skip
  if (
    flavor !== undefined &&
    relationMode !== undefined &&
    relationModesForFlavor[flavor] !== undefined &&
    relationMode !== relationModesForFlavor[flavor]
  ) {
    return true
  }

  // if flavors are enabled and test has no flavor, skip
  if (includedProviderFlavors !== undefined && flavor === undefined) {
    return true
  }

  return false
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
    includedProviderFlavors: process.env.ONLY_TEST_PROVIDER_FLAVORS?.split(','),
    excludedProviders: getExclusionsFromEnv(excludeEnvToProviderMap),
    excludedProviderFlavors: getExclusionsFromEnv(excludeEnvToProviderFlavorMap),
    updateSnapshots: process.env.UPDATE_SNAPSHOTS as 'inline' | 'external' | undefined,
  }
}

const excludeEnvToProviderMap = {
  TEST_SKIP_MONGODB: 'mongodb',
  TEST_SKIP_MSSQL: 'sqlserver',
  TEST_SKIP_COCKROACHDB: 'cockroachdb',
  TEST_SKIP_POSTGRESQL: 'postgresql',
  TEST_SKIP_SQLITE: 'sqlite',
}

const excludeEnvToProviderFlavorMap = {
  TEST_SKIP_VITESS: ProviderFlavors.VITESS_8,
  TEST_SKIP_PG: ProviderFlavors.JS_PG,
  TEST_SKIP_NEON: ProviderFlavors.JS_NEON,
  TEST_SKIP_PLANETSCALE: ProviderFlavors.JS_PLANETSCALE,
  TEST_SKIP_LIBSQL: ProviderFlavors.JS_LIBSQL,
  TEST_SKIP_MYSQL2: ProviderFlavors.JS_MYSQL2,
}

function getExclusionsFromEnv(exclusionMap: Record<string, string>) {
  return Object.entries(exclusionMap).reduce((acc, [envVarName, exclusionName]) => {
    if (process.env[envVarName]) {
      acc.push(exclusionName.toLowerCase())
    }
    return acc
  }, [] as string[])
}
