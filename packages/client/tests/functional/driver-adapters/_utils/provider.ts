import type { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'

/**
 * Return the driver adapter provider name for a given provider, if it is supported.
 */
export function getDriverAdaptersProvider(provider: Provider): DriverAdapter['provider'] {
  switch (provider) {
    case Provider.POSTGRESQL:
    case Provider.COCKROACHDB:
      return 'postgres'
    case Provider.MYSQL:
      return 'mysql'
    case Provider.SQLITE:
      return 'sqlite'
    default:
      throw new Error(`no driver adapter support for ${provider} yet`)
  }
}

/**
 * Supported providers to use in test matrix.
 */
export const driverAdaptersTestProviders = [Provider.POSTGRESQL, Provider.MYSQL, Provider.SQLITE].map((provider) => ({
  provider,
}))
