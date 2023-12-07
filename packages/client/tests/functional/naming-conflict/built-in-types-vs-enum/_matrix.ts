import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'
import { builtInNames } from '../_builtInNames'

export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
    },
    {
      provider: Providers.MYSQL,
    },
    {
      provider: Providers.MONGODB,
    },
    {
      provider: Providers.COCKROACHDB,
    },
  ],

  builtInNames.map((enumName) => ({
    enumName,
  })),
])
