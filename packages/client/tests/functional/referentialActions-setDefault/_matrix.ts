import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const driverAdapters = [
  Providers.POSTGRESQL,
  Providers.COCKROACHDB,
  Providers.SQLSERVER,
  Providers.SQLITE,
  Providers.MYSQL, // SetDefault is silently interpreted as NoAction by InnoDB on MySQL 8+
] as const

const providersMatrix = driverAdapters.map((provider) => ({
  provider,
  defaultUserId: 3,
}))

export default defineMatrix(() => [providersMatrix])
