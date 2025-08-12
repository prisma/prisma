import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

export default defineMatrix(() => [
  [
    { provider: Providers.SQLITE, generatorType: 'prisma-client-ts' },
    { provider: Providers.POSTGRESQL, generatorType: 'prisma-client-ts' },
    { provider: Providers.MYSQL, generatorType: 'prisma-client-ts' },
    // { provider: Providers.MONGODB, generatorType: 'prisma-client-ts' }, // TODO: we have type issues to fix with the new client generator
    { provider: Providers.COCKROACHDB, generatorType: 'prisma-client-ts' },
    { provider: Providers.SQLSERVER, generatorType: 'prisma-client-ts' },
  ],
])
