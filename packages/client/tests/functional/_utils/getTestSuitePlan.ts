import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { ProviderFlavors } from './providerFlavors'
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
  includedProviderFlavors?: string[]
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
  suiteConfig: NamedTestSuiteConfig[],
  clientMeta: ClientMeta,
  options?: MatrixOptions,
): TestPlanEntry[] {
  const context = buildPlanContext()

  const shouldSkipAll = shouldSkipTestSuite(clientMeta, options)

  return suiteConfig.map((namedConfig, configIndex) => ({
    name: getTestSuiteFullName(suiteMeta, namedConfig),
    skip: shouldSkipAll || shouldSkipProvider(context, namedConfig, configIndex, clientMeta),
    suiteConfig: namedConfig,
  }))
}

function shouldSkipTestSuite(clientMeta: ClientMeta, options?: MatrixOptions): boolean {
  if (!clientMeta.dataProxy || !options?.skipDataProxy) {
    return false
  }
  return options.skipDataProxy.runtimes.includes(clientMeta.runtime)
}

function shouldSkipProvider(
  {
    updateSnapshots,
    includedProviders,
    excludedProviders,
    includedProviderFlavors,
    excludedProviderFlavors,
  }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  clientMeta: ClientMeta,
): boolean {
  const provider = config.matrixOptions['provider'].toLocaleLowerCase()
  const providerFlavor = config.matrixOptions['providerFlavor']?.toLocaleLowerCase()

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

  if (includedProviderFlavors && !includedProviderFlavors.includes(providerFlavor)) {
    return true
  }

  if (clientMeta.dataProxy && provider === 'sqlite') {
    return true
  }

  return excludedProviders.includes(provider) || excludedProviderFlavors.includes(providerFlavor)
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
    excludedProviders: getExcludedProviders(),
    includedProviderFlavors: process.env.ONLY_TEST_PROVIDER_FLAVORS?.split(','),
    excludedProviderFlavors: getExcludedProviderFlavors(),
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
}

function getExcludedProviderFlavors() {
  return Object.entries(excludeEnvToProviderFlavorMap).reduce((acc, [envVarName, providerFlavor]) => {
    if (process.env[envVarName]) {
      acc.push(providerFlavor)
    }
    return acc
  }, [] as string[])
}

function getExcludedProviders() {
  return Object.entries(excludeEnvToProviderMap).reduce((acc, [envVarName, provider]) => {
    if (process.env[envVarName]) {
      acc.push(provider)
    }
    return acc
  }, [] as string[])
}
