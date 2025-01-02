import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLSERVER,
    },
    {
      provider: Providers.MONGODB,
    },
    {
      provider: Providers.MYSQL,
    },
  ],
])
