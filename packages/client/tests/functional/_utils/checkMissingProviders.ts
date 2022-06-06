import { getTestSuiteMeta, TestSuiteConfig } from './getTestSuiteInfo'
import { Providers } from './providers'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>

export type MatrixOptions = {
  optOut: {
    from: `${Providers}`[]
    reason: string
  }
}

/**
 * Ensure that we are not forgetting to add a provider to the matrix unless we
 * explicitly opt out during in the {@link setupTestSuiteMatrix} creation.
 * @param suiteConfigs
 * @param suiteMeta
 * @param options
 */
export function checkMissingProviders({
  suiteConfig,
  suiteMeta,
  options,
}: {
  suiteConfig: TestSuiteConfig[]
  suiteMeta: TestSuiteMeta
  options?: MatrixOptions
}) {
  const suiteConfigProviders = suiteConfig.map(({ provider }) => provider)

  const missingProviders = Object.values(Providers).reduce((acc, provider) => {
    if (suiteConfigProviders.includes(provider)) return acc
    if (options?.optOut?.from.includes(provider)) return acc

    return [...acc, provider]
  }, [] as Providers[])

  if (missingProviders.length) {
    throw new Error(
      `Test: '${suiteMeta.testDirName}' is missing providers '${missingProviders
        .map((x) => `'${x}'`)
        .join(', ')}' out out using options.optOut`,
    )
  }
}
