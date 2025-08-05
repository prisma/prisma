import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

export default defineMatrix(() => [
  [
    { provider: Providers.SQLITE, generatorType: 'prisma-client-js' },
    { provider: Providers.POSTGRESQL, generatorType: 'prisma-client-js' },
    { provider: Providers.MYSQL, generatorType: 'prisma-client-js' },
    { provider: Providers.MONGODB, generatorType: 'prisma-client-js' },
    { provider: Providers.COCKROACHDB, generatorType: 'prisma-client-js' },
    { provider: Providers.SQLSERVER, generatorType: 'prisma-client-js' },
  ],
])
