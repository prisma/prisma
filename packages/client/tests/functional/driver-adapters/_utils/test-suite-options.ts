import { Providers } from '../../_utils/providers'
import type { MatrixOptions } from '../../_utils/types'

/**
 * Opt out from providers not specified in `driverAdaptersTestProviders` in `setupTestSuite`
 * (to avoid the error about missing providers in the test suite matrix).
 */
export const optOutFromProvidersWithNoMatchingDriverAdapters: MatrixOptions['optOut'] = {
  from: [Providers.COCKROACHDB, Providers.SQLSERVER, Providers.MONGODB],
  reason: 'no availability of a Driver Adapter with these providers yet',
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
  skipEngine: {
    from: ['binary'],
    reason: 'driver adapters are not supported with binary engine',
  },
  skipDataProxy,
  optOut: optOutFromProvidersWithNoMatchingDriverAdapters,
}
