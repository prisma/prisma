import { defineMatrix } from '../_utils/defineMatrix'
import { getProviderFromFlavor } from '../_utils/providerFlavors'
import { Providers } from '../_utils/providers'

const providerFlavors = [
  Providers.POSTGRESQL,
  Providers.COCKROACHDB,
  Providers.SQLSERVER,
  Providers.SQLITE,
  Providers.MYSQL, // SetDefault is silently interpreted as NoAction by InnoDB on MySQL 8+
] as const

const defaultUserId = 3

const providersMatrix = providerFlavors.map((providerFlavor) => ({
  provider: getProviderFromFlavor(providerFlavor),
  providerFlavor,
  defaultUserId,
}))

export default defineMatrix(() => [providersMatrix])
