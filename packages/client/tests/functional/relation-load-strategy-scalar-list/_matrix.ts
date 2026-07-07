import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'
import { RelationLoadStrategy } from './_common'

// Scalar list (array) columns are only supported on PostgreSQL and CockroachDB,
// which are also the relationJoins-capable providers relevant here.
export default defineMatrix(() => [
  [{ provider: Providers.POSTGRESQL }, { provider: Providers.COCKROACHDB }],
  [{ strategy: 'query' as RelationLoadStrategy }, { strategy: 'join' as RelationLoadStrategy }],
])
