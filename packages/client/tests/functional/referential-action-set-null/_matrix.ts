import { defineMatrix } from '../_utils/defineMatrix'

const providerFlavors = ['postgres', 'mysql', 'mariadb', 'cockroach', 'mssql'] as const
export type ProviderFlavor = typeof providerFlavors[number]

function getProviderFromFlavor(providerFlavor: ProviderFlavor) {
  switch (providerFlavor) {
    case 'mariadb':
      return 'mysql'
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
