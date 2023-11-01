import { MatrixOptions } from '../../_utils/types'

/**
 * Opt out from providers not specified in `driverAdaptersTestProviders` in `setupTestSuite`
 * (to avoid the error about missing providers in the test suite matrix).
 */
export const optOutFromProvidersWithNoMatchingFlavours: MatrixOptions['optOut'] = {
  from: ['cockroachdb', 'sqlserver', 'mongodb'],
  reason: 'no corresponding flavour of driver adapters yet',
}

/**
 * Default `skipDataProxy` option for driver adapters tests.
 */
export const skipDataProxy: MatrixOptions['skipDataProxy'] = {
  runtimes: ['node', 'edge'],
  reason: "driver adapters don't work with data proxy",
}

/**
 * Default sensible options for driver adapters tests.
 */
export const defaultTestSuiteOptions: MatrixOptions = {
  skipDefaultClientInstance: true,
  skipBinary: {
    reason: 'driver adapters are not supported with binary engine',
  },
  skipDataProxy,
  optOut: optOutFromProvidersWithNoMatchingFlavours,
}
