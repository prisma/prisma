import { SqlDriver } from '@prisma/driver-utils'

import { Providers as Provider } from '../../_utils/providers'

/**
 * Return the driver provider name for a given provider, if it is supported.
 */
export function getDriverAdaptersProvider(provider: Provider): SqlDriver['provider'] {
  switch (provider) {
    case Provider.POSTGRESQL:
    case Provider.COCKROACHDB:
      return 'postgres'
    case Provider.MYSQL:
      return 'mysql'
    case Provider.SQLITE:
      return 'sqlite'
    default:
      throw new Error(`no driver support for ${provider} yet`)
  }
}

/**
 * Supported providers to use in test matrix.
 */
export const driverAdaptersTestProviders = [Provider.POSTGRESQL, Provider.MYSQL, Provider.SQLITE].map((provider) => ({
  provider,
}))
