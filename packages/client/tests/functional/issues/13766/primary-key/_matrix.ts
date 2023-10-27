import { defineMatrix } from '../../../_utils/defineMatrix'
import { Providers } from '../../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
    },
    {
      provider: Providers.MONGODB,
    },
    {
      provider: Providers.SQLSERVER,
    },
    {
      provider: Providers.POSTGRESQL,
    },
    {
      provider: Providers.MYSQL,
    },
    {
      provider: Providers.COCKROACHDB,
    },
  ],
])
