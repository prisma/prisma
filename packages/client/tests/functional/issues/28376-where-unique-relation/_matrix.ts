import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

const matrix = defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
    },
    {
      provider: Providers.MYSQL,
    },
    {
      provider: Providers.SQLITE,
    },
  ],
])

export default matrix

