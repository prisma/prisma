import { defineMatrix } from '../_utils/defineMatrix'
import { allProviders } from '../_utils/providers'
import { RelationLoadStrategy } from './_common'

export default defineMatrix(() => [
  allProviders,
  [
    {
      strategy: 'query' as RelationLoadStrategy,
    },
    {
      strategy: 'join' as RelationLoadStrategy,
    },
  ],
])
