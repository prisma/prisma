import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
    },
    {
      provider: Providers.MYSQL,
    },
    {
      provider: Providers.COCKROACHDB,
    },
    {
      provider: Providers.MONGODB,
    },
    {
      provider: Providers.SQLITE,
    },
  ],
])
