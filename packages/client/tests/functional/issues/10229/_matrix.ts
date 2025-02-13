import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      url: 'postgresql://invalid:invalid@invalid.org:123/invalid',
    },
    {
      provider: Providers.MYSQL,
      url: 'mysql://invalid:invalid@invalid:3307/invalid',
    },
    {
      provider: Providers.COCKROACHDB,
      url: 'postgresql://invalid:invalid@invalid.org:123/invalid',
    },
  ],
])
