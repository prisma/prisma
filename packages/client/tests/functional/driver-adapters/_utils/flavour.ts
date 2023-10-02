import { DriverAdapter } from '@prisma/driver-adapter-utils'

import { Providers as Provider } from '../../_utils/providers'

/**
 * Driver adapter flavour (SQL dialect).
 */
type Flavour = DriverAdapter['flavour']

/**
 * Get driver adapter flavour from provider in schema.
 */
export function flavourFromProvider(provider: Provider): Flavour {
  switch (provider) {
    case Provider.POSTGRESQL:
    case Provider.COCKROACHDB:
      return 'postgres'
    case Provider.MYSQL:
      return 'mysql'
    case Provider.SQLITE:
      return 'sqlite'
    default:
      throw new Error(`no driver adapter flavour for ${provider} yet`)
  }
}

/**
 * Supported providers to use in test matrix.
 */
export const driverAdaptersTestProviders = [Provider.POSTGRESQL, Provider.MYSQL, Provider.SQLITE].map((provider) => ({
  provider,
}))
