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

// if the value is a string, skip the provider flavor indicated by the key
const skip = {
  mssql: process.env.TEST_SKIP_MSSQL === 'true',
  cockroach: process.env.TEST_SKIP_COCKROACHDB === 'true',
}

const providerFlavorsToSkip = Object.entries(skip)
  .filter(([_, shouldSkip]) => shouldSkip)
  .map(([providerFlavor, _]) => providerFlavor as ProviderFlavor)

const availableProviderFlavors = providerFlavors.filter(
  (providerFlavor) => !providerFlavorsToSkip.includes(providerFlavor),
)

const matrix = availableProviderFlavors.map((providerFlavor) => ({
  provider: getProviderFromFlavor(providerFlavor),
  providerFlavor,
}))

export default defineMatrix(() => [matrix])
