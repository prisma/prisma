import { defineMatrix } from '../_utils/defineMatrix'
import { providersSupportingRelationJoins, RelationLoadStrategy } from './_common'

export default defineMatrix(() => [
  providersSupportingRelationJoins.map((provider) => ({ provider })),
  [
    {
      strategy: 'query' as RelationLoadStrategy,
    },
    {
      strategy: 'join' as RelationLoadStrategy,
    },
  ],
])
