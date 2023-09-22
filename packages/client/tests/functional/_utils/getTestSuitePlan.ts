import { klona } from 'klona'

import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { flavorsForProvider, ProviderFlavors } from './providers'
import { TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, MatrixOptions } from './types'

export type TestPlanEntry = {
  name: string
  skip: boolean
  suiteConfig: NamedTestSuiteConfig
}

type SuitePlanContext = {
  includedProviders?: string[]
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
  clientMeta: ClientMeta,
  options?: MatrixOptions,
): TestPlanEntry[] {
  const context = buildPlanContext()

  const shouldSkipAll = shouldSkipTestSuite(clientMeta, options)

  const expandedSuiteConfigs = suiteConfigs.flatMap((config) => {
    return getExpandedTestSuitePlanWithProviderFlavors(config)
  })

  return expandedSuiteConfigs.map((namedConfig, configIndex) => ({
    name: getTestSuiteFullName(suiteMeta, namedConfig),
    skip: shouldSkipAll || shouldSkipSuiteConfig(context, namedConfig, configIndex, clientMeta),
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

    return newSuiteConfig
  })

  // add the original suite config to the list of expanded configs
  return [suiteConfig, ...suiteConfigExpansions]
}

function shouldSkipTestSuite(clientMeta: ClientMeta, options?: MatrixOptions): boolean {
  if (!clientMeta.dataProxy || !options?.skipDataProxy) {
    return false
  }
  return options.skipDataProxy.runtimes.includes(clientMeta.runtime)
}

function shouldSkipSuiteConfig(
  { updateSnapshots, includedProviders, excludedProviders, excludedProviderFlavors }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  clientMeta: ClientMeta,
): boolean {
  const provider = config.matrixOptions.provider.toLocaleLowerCase()
  const flavor = config.matrixOptions.providerFlavor?.toLocaleLowerCase()

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

  if (includedProviders && !includedProviders.includes(provider)) {
    return true
  }

  if (clientMeta.dataProxy && provider === 'sqlite') {
    return true
  }

  // if there is a flavor and it is in the list of excluded flavors, skip
  if (flavor && excludedProviderFlavors.includes(flavor)) {
    return true
  }

  // if we are running driver adapter tests and its not a driver test, skip
  if (process.env.TEST_DRIVER_ADAPTER === 'true' && flavor === undefined) {
    return true
  }

  // if we are running non-driver adapter tests and its a driver test, skip
  if (process.env.TEST_DRIVER_ADAPTER !== 'true' && flavor !== undefined) {
    return true
  }

  return excludedProviders.includes(provider)
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
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
}

function getExclusionsFromEnv(exclusionMap: Record<string, string>) {
  return Object.entries(exclusionMap).reduce((acc, [envVarName, exclusionName]) => {
    if (process.env[envVarName]) {
      acc.push(exclusionName.toLowerCase())
    }
    return acc
  }, [] as string[])
}
