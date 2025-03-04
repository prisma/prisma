import { klona } from 'klona'

import { getTestSuiteFullName, type NamedTestSuiteConfig } from './getTestSuiteInfo'
import { AdapterProviders, adaptersForProvider, Providers, relationModesForAdapter } from './providers'
import type { TestSuiteMeta } from './setupTestSuiteMatrix'
import type { CliMeta, MatrixOptions } from './types'

export type TestPlanEntry = {
  name: string
  skip: boolean
  suiteConfig: NamedTestSuiteConfig
}

type SuitePlanContext = {
  includedProviders?: string[]
  includedProviderAdapters?: string[]
  excludedProviders: string[]
  excludedDriverAdapters: string[]
  updateSnapshots: 'inline' | 'external' | undefined
}

/**
 * Get a test plan from a list of suite configs. Test plan tells what the name of
 * the tests are, what are their config and whether or not they should be executed or skipped
 * @param suiteMeta
 * @returns [test-suite-title: string, test-suite-config: object]
 */
export function getTestSuitePlan(
  testCliMeta: CliMeta,
  suiteMeta: TestSuiteMeta,
  suiteConfigs: NamedTestSuiteConfig[],
  options?: MatrixOptions,
): TestPlanEntry[] {
  const context = buildPlanContext()

  const expandedSuiteConfigs = suiteConfigs.flatMap((config) => {
    return getExpandedTestSuitePlanWithProviderFlavors(config)
  })

  expandedSuiteConfigs.forEach((config) => {
    config.matrixOptions.engineType ??= testCliMeta.engineType
    config.matrixOptions.clientRuntime ??= testCliMeta.runtime
    config.matrixOptions.previewFeatures ??= testCliMeta.previewFeatures
  })

  return expandedSuiteConfigs.map((namedConfig, configIndex) => ({
    name: getTestSuiteFullName(suiteMeta, namedConfig),
    skip: shouldSkipSuiteConfig(context, namedConfig, configIndex, testCliMeta, options),
    suiteConfig: namedConfig,
  }))
}

/**
 * This function takes a regular `testPlanEntry` and expands this into the
 * multiple compatible driver adapters that exist for a given provider. For
 * example, postgres => [postgres (pg), postgres (neon)], put very simply. In
 * other words, a given test matrix is expanded with the provider adapters.
 * @param suiteConfig
 * @returns
 */
function getExpandedTestSuitePlanWithProviderFlavors(suiteConfig: NamedTestSuiteConfig) {
  const provider = suiteConfig.matrixOptions.provider

  const suiteConfigExpansions = adaptersForProvider[provider].map((adapterProvider) => {
    const newSuiteConfig = klona(suiteConfig)

    newSuiteConfig.matrixOptions.driverAdapter = adapterProvider
    newSuiteConfig.parametersString += `, ${adapterProvider}`
    // ^^^ temporary until I get to the TODO in getTestSuiteParametersString

    // if the test is not doing stuff with relation mode already, we set one
    if (newSuiteConfig.matrixOptions.relationMode === undefined) {
      newSuiteConfig.matrixOptions.relationMode = relationModesForAdapter[adapterProvider]
    }

    return newSuiteConfig
  })

  // add the original suite config to the list of expanded configs
  return [suiteConfig, ...suiteConfigExpansions]
}

function shouldSkipSuiteConfig(
  {
    updateSnapshots,
    includedProviders,
    includedProviderAdapters,
    excludedProviders,
    excludedDriverAdapters: excludedProviderFlavors,
  }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  cliMeta: CliMeta,
  options?: MatrixOptions,
): boolean {
  const provider = config.matrixOptions.provider
  const driverAdapter = config.matrixOptions.driverAdapter
  const relationMode = config.matrixOptions.relationMode
  const engineType = config.matrixOptions.engineType

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

  // if one of the skip predicates is true, skip
  let isSkipped = false
  options?.skip?.((pred) => {
    isSkipped ||= typeof pred === 'boolean' ? pred : pred()
  }, config.matrixOptions)

  if (isSkipped) {
    return true
  }

  // if the test doesn't support the engine type, skip
  if (options?.skipEngine?.from.includes(engineType!)) {
    return true
  }

  // if the test needs to skip the dataproxy test, skip
  if (cliMeta.dataProxy && options?.skipDataProxy?.runtimes.includes(cliMeta.runtime)) {
    return true
  }

  // if the client doesn't support the provider, skip
  if (cliMeta.dataProxy && provider === Providers.SQLITE) {
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

  // if there is a Driver Adapter to run and it's not included, skip
  if (driverAdapter !== undefined && !includedProviderAdapters?.includes(driverAdapter)) {
    return true
  }

  // if there is a Driver Adapter to run and it's excluded, skip
  if (driverAdapter && excludedProviderFlavors.includes(driverAdapter)) {
    return true
  }

  // if the Driver Adapter is explicitly skipped in the matrix options, skip
  if (driverAdapter !== undefined && options?.skipDriverAdapter?.from.includes(driverAdapter)) {
    return true
  }

  // if there is a relation mode set and the Driver Adapter doesn't support it, skip
  if (
    driverAdapter !== undefined &&
    relationMode !== undefined &&
    relationModesForAdapter[driverAdapter] !== undefined &&
    relationMode !== relationModesForAdapter[driverAdapter]
  ) {
    return true
  }

  // if Driver Adapters are enabled and the test has no Driver Adapter, skip
  if (includedProviderAdapters !== undefined && driverAdapter === undefined) {
    return true
  }

  return false
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
    includedProviderAdapters: process.env.ONLY_TEST_PROVIDER_ADAPTERS?.split(','),
    excludedProviders: getExclusionsFromEnv(excludeEnvToProviderMap),
    excludedDriverAdapters: getExclusionsFromEnv(excludeEnvToProviderFlavorMap),
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
  TEST_SKIP_VITESS: AdapterProviders.VITESS_8,
  TEST_SKIP_PG: AdapterProviders.JS_PG,
  TEST_SKIP_NEON: AdapterProviders.JS_NEON,
  TEST_SKIP_PLANETSCALE: AdapterProviders.JS_PLANETSCALE,
  TEST_SKIP_LIBSQL: AdapterProviders.JS_LIBSQL,
  TEST_SKIP_D1: AdapterProviders.JS_D1,
}

function getExclusionsFromEnv(exclusionMap: Record<string, string>) {
  return Object.entries(exclusionMap).reduce((acc, [envVarName, exclusionName]) => {
    if (process.env[envVarName]) {
      acc.push(exclusionName.toLowerCase())
    }
    return acc
  }, [] as string[])
}
