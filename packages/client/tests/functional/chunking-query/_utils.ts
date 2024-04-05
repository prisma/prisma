import { Providers } from '../_utils/providers'

// These need to manually be kept in sync with the Query Engine's max bind values.
export const MAX_BIND_VALUES_BY_PROVIDER: Record<Providers, number> = {
  [Providers.POSTGRESQL]: 32766,
  [Providers.COCKROACHDB]: 32766,
  [Providers.MYSQL]: 65535,
  [Providers.SQLITE]: 999,
  [Providers.SQLSERVER]: 2099,
  [Providers.MONGODB]: -1,
} as const

export const EXCESS_BIND_VALUES_BY_PROVIDER = Object.fromEntries(
  Object.entries(MAX_BIND_VALUES_BY_PROVIDER).map(([provider, max]) => [provider, max + 10]),
) as Record<Providers, number>

export const RELATION_JOINS_NO_CHUNKING_ERROR_MSG =
  'Query parameter limit exceeded error: Joined queries cannot be split into multiple queries'
