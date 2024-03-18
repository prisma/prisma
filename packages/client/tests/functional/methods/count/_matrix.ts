import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
      foreignKeyId: 'String?',
    },
    {
      provider: Providers.POSTGRESQL,
      foreignKeyId: 'String?',
    },
    {
      provider: Providers.MYSQL,
      foreignKeyId: 'String?',
    },
    {
      provider: Providers.SQLSERVER,
      foreignKeyId: 'String?',
    },
    {
      provider: Providers.COCKROACHDB,
      foreignKeyId: 'String?',
    },
    {
      provider: Providers.MONGODB,
      foreignKeyId: 'String @db.ObjectId',
    },
  ],
])
