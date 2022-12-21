import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      relationMode: 'prisma',
    },
    {
      provider: Providers.POSTGRESQL,
      relationMode: '', // empty means default (foreignKeys)
    },
    {
      provider: Providers.MYSQL,
      relationMode: 'prisma',
    },
    {
      provider: Providers.MYSQL,
      relationMode: '', // empty means default (foreignKeys)
    },
  ],
])
