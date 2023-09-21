import { klona } from 'klona'

import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { flavorsForProvider } from './providers'
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

  const testPlanEntry = suiteConfigs.flatMap((namedConfig, configIndex) => {
    const testPlanEntry: TestPlanEntry = {
      name: getTestSuiteFullName(suiteMeta, namedConfig),
      skip: shouldSkipAll || shouldSkipProvider(context, namedConfig, configIndex, clientMeta),
      suiteConfig: namedConfig,
    }

    if (clientMeta.driverAdapter === true) {
      return getExpandedTestSuitePlanEntryForDriverAdapter(testPlanEntry)
    }

    return [testPlanEntry]
  })

  // console.log(JSON.stringify(testPlanEntry, null, 2))

  return testPlanEntry
}

/**
 * This function takes a regular `testPlanEntry` and expands this into the
 * multiple flavors of driver adapters that exist for a given provider. For
 * example, [postgres] => [postgres (pg), postgres (neon)], put very simply. In
 * other words, a given test matrix is expanded with the provider flavors.
 * @param testPlanEntry
 * @returns
 */
function getExpandedTestSuitePlanEntryForDriverAdapter(testPlanEntry: TestPlanEntry) {
  const provider = testPlanEntry.suiteConfig.matrixOptions.provider

  if (provider === undefined) return [testPlanEntry]

  const expandedTestSuitePlan = flavorsForProvider[provider].map((flavor) => {
    const newTestPlanEntry = klona(testPlanEntry)

    newTestPlanEntry.name += ` (${flavor})`
    newTestPlanEntry.suiteConfig.parametersString += `, ${flavor}`
    newTestPlanEntry.suiteConfig.matrixOptions.providerFlavor = flavor

    return newTestPlanEntry
  })

  // we skip the original test in favor of running the flavored ones
  return [{ ...testPlanEntry, skip: true }, ...expandedTestSuitePlan]
}

function shouldSkipTestSuite(clientMeta: ClientMeta, options?: MatrixOptions): boolean {
  if (!clientMeta.dataProxy || !options?.skipDataProxy) {
    return false
  }
  return options.skipDataProxy.runtimes.includes(clientMeta.runtime)
}

function shouldSkipProvider(
  { updateSnapshots, includedProviders, excludedProviders }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  clientMeta: ClientMeta,
): boolean {
  const provider = config.matrixOptions['provider'].toLocaleLowerCase()
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

  if (clientMeta.driverAdapter && ['mysql', 'postgresql'].includes(provider) === false) {
    return true
  }

  return excludedProviders.includes(provider)
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
    excludedProviders: getExcludedProviders(),
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

function getExcludedProviders() {
  return Object.entries(excludeEnvToProviderMap).reduce((acc, [envVarName, provider]) => {
    if (process.env[envVarName]) {
      acc.push(provider)
    }
    return acc
  }, [] as string[])
}
