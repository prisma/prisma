import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLITE,
      testEmail: 'sqlite-user@example.com',
    },
    {
      provider: Providers.MYSQL,
      testEmail: 'mysql-user@example.com',
    },
    {
      provider: Providers.SQLSERVER,
      testEmail: 'sqlserver-user@example.com',
    },
    {
      provider: Providers.POSTGRESQL,
      testEmail: 'postgres-user@example.com',
    },
    {
      provider: Providers.COCKROACHDB,
      testEmail: 'cockroach-user@example.com',
    },
  ],
])
