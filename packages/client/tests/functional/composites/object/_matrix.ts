import { defineMatrix } from '../../_utils/defineMatrix'
import { Providers } from '../../_utils/providers'

const testMatrix = defineMatrix(() => [
  [
    {
      provider: Providers.MONGODB,
    },
  ],
  [
    {
      contentProperty: 'required',
    },

    {
      contentProperty: 'optional',
    },
  ],
])

export const setupTestSuite: (typeof testMatrix)['setupTestSuite'] = (tests, options) => {
  testMatrix.setupTestSuite(tests, {
    ...options,
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason: 'composites are mongo-specific feature',
    },
  })
}

export default testMatrix
