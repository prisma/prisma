import { defineMatrix } from '../_utils/defineMatrix'

const providerFlavors = ['postgres', 'mysql', 'cockroach', 'mssql'] as const
export type ProviderFlavor = typeof providerFlavors[number]

function getProviderFromFlavor(providerFlavor: ProviderFlavor) {
  switch (providerFlavor) {
    // skipping MARIADB at the moment, as TEST_FUNCTIONAL_MARIADB_URI is not set up in CI
    // and testing this on mariadb is not that important at the moment
    // case 'mariadb':
    //   return 'mysql'
    case 'mssql':
      return 'sqlserver'
    case 'postgres':
      return 'postgresql'
    case 'cockroach':
      return 'cockroachdb'
    default:
      return providerFlavor
  }
}

const matrix = providerFlavors.map((providerFlavor) => ({
  provider: getProviderFromFlavor(providerFlavor),
  providerFlavor,
}))

export default defineMatrix(() => [matrix])
