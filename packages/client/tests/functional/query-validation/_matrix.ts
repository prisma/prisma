import { defineMatrix } from '../_utils/defineMatrix'
import { providersSupportingRelationJoins } from '../relation-load-strategy/_common'

export default defineMatrix(() => [
  providersSupportingRelationJoins.map((provider) => ({ provider })),
  [
    {
      previewFeatures: '',
    },
  ],
])
