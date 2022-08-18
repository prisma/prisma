import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { TestSuiteMeta } from './setupTestSuiteMatrix'

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

export function getTestSuitePlan(suiteMeta: TestSuiteMeta, suiteConfig: NamedTestSuiteConfig[]): TestPlanEntry[] {
  const context = buildPlanContext()

  return suiteConfig.map((namedConfig, configIndex) => ({
    name: getTestSuiteFullName(suiteMeta, namedConfig),
    skip: shouldSkipProvider(context, namedConfig, configIndex),
    suiteConfig: namedConfig,
  }))
}

function shouldSkipProvider(
  { updateSnapshots, includedProviders, excludedProviders }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
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

  if (process.env.DATA_PROXY && provider === 'sqlite') {
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
